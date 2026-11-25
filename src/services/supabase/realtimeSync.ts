import type { RealtimeChannel } from '@supabase/supabase-js';
import type { ProfileId } from '../../config/profiles';
import type { RecipeId } from '../../config/recipes';
import type { StationId } from '../../config/kitchenLayout';
import { getSupabaseClient } from './client';
import type {
  AnimState,
  BroadcastPlayerPayload,
  HomeSnapshot,
  PresencePayload,
} from './types';
import { playerMotionStore } from '../../store/playerMotionStore';
import { useGameStore } from '../../store/useGameStore';
import { useSessionStore } from '../../store/useSessionStore';

const HOME_CHANNEL_NAME = 'kitchen:home';
const LOCAL_BC_NAME = 'kitchen:home:local';
const BROADCAST_INTERVAL_MS = 66; // ~15 Hz throttle

type LocalChannelMsg =
  | { type: 'player_state'; payload: BroadcastPlayerPayload }
  | { type: 'presence_ping'; payload: PresencePayload }
  | { type: 'presence_leave'; profileId: ProfileId }
  | { type: 'home_snapshot'; payload: HomeSnapshot };

class KitchenRealtimeSync {
  private channel: RealtimeChannel | null = null;
  private localChannel: BroadcastChannel | null = null;
  private localPresenceTimer: number | null = null;
  private localPartnerLastSeen = 0;

  private myProfileId: ProfileId | null = null;
  private myDisplayName = '';
  private activeStationId: StationId | null = null;

  private seq = 0;
  private lastBroadcastAt = 0;
  private lastSentX = Number.NaN;
  private lastSentZ = Number.NaN;
  private lastSentRotY = Number.NaN;
  private lastSentAnim: AnimState = 'Idle';

  public connect(profileId: ProfileId, displayName: string): void {
    this.disconnect();
    this.myProfileId = profileId;
    this.myDisplayName = displayName;
    this.activeStationId = null;
    this.seq = 0;
    this.lastSentX = Number.NaN;

    const supabase = getSupabaseClient();
    if (supabase) {
      this.connectSupabase(profileId, displayName);
    } else {
      this.connectLocalChannel(profileId, displayName);
    }
  }

  private connectSupabase(profileId: ProfileId, displayName: string): void {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    useSessionStore.getState().setConnectionStatus('connecting');

    const channel = supabase.channel(HOME_CHANNEL_NAME, {
      config: {
        broadcast: { self: false, ack: false },
        presence: { key: profileId },
      },
    });

    // 1. Realtime Broadcast: player position/facing/anim (NEVER written to Postgres)
    channel.on('broadcast', { event: 'player_state' }, ({ payload }) => {
      const data = payload as BroadcastPlayerPayload;
      if (!data || data.profileId === this.myProfileId) return;
      playerMotionStore.applyRemotePacket(
        data.profileId,
        data.x,
        data.z,
        data.rotY,
        data.anim,
        data.seq,
      );
    });

    // 2. Realtime Presence: online status & active character
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PresencePayload>();
      const map: Partial<Record<ProfileId, PresencePayload>> = {};
      let partnerOnline = false;
      let partnerId: ProfileId | null = null;

      for (const entries of Object.values(state)) {
        const latest = entries[entries.length - 1];
        if (!latest) continue;
        map[latest.profileId] = latest;
        if (latest.profileId !== this.myProfileId) {
          partnerOnline = true;
          partnerId = latest.profileId;
        }
      }

      useSessionStore.getState().setOnlineProfiles(map);
      playerMotionStore.setRemoteActive(partnerOnline, partnerId);
    });

    channel.on('presence', { event: 'join' }, ({ newPresences }) => {
      for (const p of newPresences as unknown as PresencePayload[]) {
        if (p.profileId && p.profileId !== this.myProfileId) {
          useGameStore.getState().pushToast(`${p.displayName} mutfağa katıldı!`, 'success');
          // Send immediate position snapshot so joining partner sees us instantly
          this.sendImmediateState();
        }
      }
    });

    channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      for (const p of leftPresences as unknown as PresencePayload[]) {
        if (p.profileId && p.profileId !== this.myProfileId) {
          useGameStore.getState().pushToast(`${p.displayName} mutfaktan ayrıldı.`, 'info');
        }
      }
    });

    // 3. Postgres Changes: persistent home state (wallet, stock, stations/locks, recipes)
    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'home_state' },
        (payload) => {
          const row = payload.new as { coins?: number } | undefined;
          if (row && typeof row.coins === 'number') {
            useGameStore.getState().setCoins(row.coins);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'home_inventory' },
        (payload) => {
          const row = payload.new as { item_id?: string; quantity?: number } | undefined;
          if (row?.item_id) {
            useGameStore
              .getState()
              .patchInventoryItem(row.item_id, Number(row.quantity ?? 0));
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kitchen_stations' },
        (payload) => {
          const row = payload.new as {
            id?: StationId;
            status?: 'idle' | 'in_use' | 'ready';
            active_recipe_id?: RecipeId | null;
            station_payload?: Record<string, unknown>;
            locked_by?: ProfileId | null;
            lock_expires_at?: string | null;
          };
          if (row?.id) {
            useGameStore.getState().patchStation({
              id: row.id,
              status: row.status ?? 'idle',
              activeRecipeId: row.active_recipe_id ?? null,
              stationPayload: row.station_payload ?? {},
              lockedBy: row.locked_by ?? null,
              lockExpiresAt: row.lock_expires_at ?? null,
            });
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recipe_progress' },
        (payload) => {
          const row = payload.new as {
            recipe_id?: RecipeId;
            in_game_cook_count?: number;
            irl_cooked_count?: number;
            irl_confirmed_p1?: boolean;
            irl_confirmed_p2?: boolean;
            irl_last_cooked_at?: string | null;
            irl_note?: string | null;
          };
          if (row?.recipe_id) {
            useGameStore.getState().patchRecipe({
              recipeId: row.recipe_id,
              inGameCookCount: Number(row.in_game_cook_count ?? 0),
              irlCookedCount: Number(row.irl_cooked_count ?? 0),
              irlConfirmedP1: Boolean(row.irl_confirmed_p1),
              irlConfirmedP2: Boolean(row.irl_confirmed_p2),
              irlLastCookedAt: row.irl_last_cooked_at ?? null,
              irlNote: row.irl_note ?? null,
            });
          }
        },
      );

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        useSessionStore.getState().setConnectionStatus('connected');
        await channel.track({
          profileId,
          displayName,
          onlineAt: new Date().toISOString(),
          activeStationId: this.activeStationId,
        } satisfies PresencePayload);
        this.sendImmediateState();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        useSessionStore.getState().setConnectionStatus('disconnected');
      }
    });

    this.channel = channel;
  }

  private connectLocalChannel(profileId: ProfileId, displayName: string): void {
    useSessionStore.getState().setConnectionStatus('connected');
    const myPresence: PresencePayload = {
      profileId,
      displayName,
      onlineAt: new Date().toISOString(),
      activeStationId: null,
    };
    useSessionStore.getState().setOnlineProfiles({ [profileId]: myPresence });

    if (typeof BroadcastChannel === 'undefined') return;

    const bc = new BroadcastChannel(LOCAL_BC_NAME);
    this.localChannel = bc;

    bc.onmessage = (event: MessageEvent<LocalChannelMsg>) => {
      const msg = event.data;
      if (!msg) return;

      if (msg.type === 'player_state') {
        const d = msg.payload;
        if (d.profileId === this.myProfileId) return;
        this.localPartnerLastSeen = Date.now();
        playerMotionStore.applyRemotePacket(d.profileId, d.x, d.z, d.rotY, d.anim, d.seq);
      } else if (msg.type === 'presence_ping') {
        const p = msg.payload;
        if (p.profileId === this.myProfileId) return;
        const wasOnline = Boolean(useSessionStore.getState().onlineProfiles[p.profileId]);
        this.localPartnerLastSeen = Date.now();
        useSessionStore.getState().setOnlineProfiles({
          ...useSessionStore.getState().onlineProfiles,
          [p.profileId]: p,
        });
        playerMotionStore.setRemoteActive(true, p.profileId);
        if (!wasOnline) {
          useGameStore.getState().pushToast(`${p.displayName} (2. sekme) katıldı!`, 'success');
          this.sendImmediateState();
        }
      } else if (msg.type === 'presence_leave') {
        if (msg.profileId === this.myProfileId) return;
        const current = { ...useSessionStore.getState().onlineProfiles };
        delete current[msg.profileId];
        useSessionStore.getState().setOnlineProfiles(current);
        playerMotionStore.setRemoteActive(false, null);
      } else if (msg.type === 'home_snapshot') {
        useGameStore.getState().applySnapshot(msg.payload);
      }
    };

    const emitPresence = () => {
      if (!this.myProfileId || !this.localChannel) return;
      const payload: PresencePayload = {
        profileId: this.myProfileId,
        displayName: this.myDisplayName,
        onlineAt: new Date().toISOString(),
        activeStationId: this.activeStationId,
      };
      this.localChannel.postMessage({ type: 'presence_ping', payload } satisfies LocalChannelMsg);

      // Expire stale local partner presence after 6 seconds
      if (this.localPartnerLastSeen > 0 && Date.now() - this.localPartnerLastSeen > 6000) {
        const partnerId: ProfileId = this.myProfileId === 'p1' ? 'p2' : 'p1';
        const next = { ...useSessionStore.getState().onlineProfiles };
        delete next[partnerId];
        useSessionStore.getState().setOnlineProfiles(next);
        playerMotionStore.setRemoteActive(false, null);
        this.localPartnerLastSeen = 0;
      }
    };

    emitPresence();
    this.localPresenceTimer = window.setInterval(emitPresence, 2000);
  }

  public updatePresenceStation(stationId: StationId | null): void {
    this.activeStationId = stationId;
    if (!this.myProfileId) return;

    const payload: PresencePayload = {
      profileId: this.myProfileId,
      displayName: this.myDisplayName,
      onlineAt: new Date().toISOString(),
      activeStationId: stationId,
    };

    if (this.channel) {
      void this.channel.track(payload);
    } else if (this.localChannel) {
      this.localChannel.postMessage({ type: 'presence_ping', payload } satisfies LocalChannelMsg);
    }
  }

  public sendImmediateState(): void {
    const loc = playerMotionStore.local;
    this.maybeBroadcastMotion(loc.x, loc.z, loc.rotY, loc.anim, true);
  }

  /**
   * Throttled (~15 Hz) Realtime Broadcast publisher.
   * Only emits when position/rotation/animation changed, plus immediate flush on stop.
   */
  public maybeBroadcastMotion(
    x: number,
    z: number,
    rotY: number,
    anim: AnimState,
    force = false,
  ): void {
    if (!this.myProfileId) return;

    const now = performance.now();
    const animChanged = anim !== this.lastSentAnim;
    const moved =
      Number.isNaN(this.lastSentX) ||
      Math.hypot(x - this.lastSentX, z - this.lastSentZ) > 0.012 ||
      Math.abs(rotY - this.lastSentRotY) > 0.03;

    if (!force && !animChanged && !moved) return;
    if (!force && !animChanged && now - this.lastBroadcastAt < BROADCAST_INTERVAL_MS) return;

    this.lastBroadcastAt = now;
    this.lastSentX = x;
    this.lastSentZ = z;
    this.lastSentRotY = rotY;
    this.lastSentAnim = anim;
    this.seq += 1;

    const payload: BroadcastPlayerPayload = {
      profileId: this.myProfileId,
      x: Math.round(x * 1000) / 1000,
      z: Math.round(z * 1000) / 1000,
      rotY: Math.round(rotY * 1000) / 1000,
      anim,
      seq: this.seq,
      ts: Date.now(),
    };

    if (this.channel) {
      void this.channel.send({
        type: 'broadcast',
        event: 'player_state',
        payload,
      });
    } else if (this.localChannel) {
      this.localChannel.postMessage({
        type: 'player_state',
        payload,
      } satisfies LocalChannelMsg);
    }
  }

  public postLocalSnapshot(snapshot: HomeSnapshot): void {
    if (this.localChannel) {
      this.localChannel.postMessage({
        type: 'home_snapshot',
        payload: snapshot,
      } satisfies LocalChannelMsg);
    }
  }

  public disconnect(): void {
    if (this.localPresenceTimer !== null) {
      window.clearInterval(this.localPresenceTimer);
      this.localPresenceTimer = null;
    }

    if (this.localChannel) {
      if (this.myProfileId) {
        try {
          this.localChannel.postMessage({
            type: 'presence_leave',
            profileId: this.myProfileId,
          } satisfies LocalChannelMsg);
        } catch {
          // Ignore closed channel
        }
      }
      this.localChannel.close();
      this.localChannel = null;
    }

    if (this.channel) {
      const supabase = getSupabaseClient();
      if (supabase) {
        void supabase.removeChannel(this.channel);
      }
      this.channel = null;
    }

    this.myProfileId = null;
    playerMotionStore.setRemoteActive(false, null);
    useSessionStore.getState().setConnectionStatus('disconnected');
  }
}

export const kitchenRealtime = new KitchenRealtimeSync();

export function broadcastLocalSnapshot(snapshot: HomeSnapshot): void {
  kitchenRealtime.postLocalSnapshot(snapshot);
}
