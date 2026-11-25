import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { CharacterId } from '../../config/characters';
import { PROFILES, type ProfileId } from '../../config/profiles';
import { RECIPES, type RecipeDifficulty, type RecipeId } from '../../config/recipes';
import type { RoomId, StationId } from '../../config/kitchenLayout';
import type { CustomerAvatarId, TableId } from '../../config/restaurantLayout';
import {
  EMPTY_LOBBY_OCCUPANCY,
  buildLobbyOccupancy,
  isValidCharacterId,
  isValidProfileId,
  type LobbyOccupancy,
  type OccupiedEntry,
} from '../../domain/lobbyOccupancy';
import {
  PARTNER_BROADCAST_GRACE_MS,
  isFinalPresenceLeave,
  isInitialPresenceJoin,
  reconcileOnlineProfiles,
  shouldExpirePartner,
} from '../../domain/partnerPresence';
import type { OrderStatus } from '../../domain/restaurantRules';
import { getTranslations } from '../../i18n/translations';
import { createLobbyObserverClient, getSupabaseClient } from './client';
import type {
  AnimState,
  BroadcastPlayerPayload,
  HomeSnapshot,
  PresencePayload,
} from './types';
import { playerMotionStore } from '../../store/playerMotionStore';
import { useGameStore } from '../../store/useGameStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import { useSessionStore } from '../../store/useSessionStore';

const HOME_CHANNEL_NAME = 'kitchen:home';
const DB_CHANNEL_NAME = 'kitchen:db';
const LOCAL_BC_NAME = 'kitchen:home:local';
const BROADCAST_INTERVAL_MS = 66; // ~15 Hz throttle when moving
const IDLE_HEARTBEAT_MS = 2500; // 0.4 Hz pure Broadcast keepalive (0 DB writes)
const WATCHDOG_INTERVAL_MS = 5000;
const SWEEP_INTERVAL_MS = 3000;
const RECONNECT_BACKOFF_MS = [1000, 2000, 4000, 6000] as const;

type LocalChannelMsg =
  | { type: 'player_state'; payload: BroadcastPlayerPayload }
  | { type: 'sync_request'; from: ProfileId }
  | { type: 'player_leave'; profileId: ProfileId }
  | { type: 'lobby_probe' }
  | { type: 'presence_ping'; payload: PresencePayload }
  | { type: 'presence_leave'; profileId: ProfileId }
  | { type: 'home_snapshot'; payload: HomeSnapshot };

function makeNonce(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

class KitchenRealtimeSync {
  // Split Realtime channels: Broadcast+Presence (`kitchen:home`) vs Postgres Changes (`kitchen:db`)
  private presenceChannel: RealtimeChannel | null = null;
  private dbChannel: RealtimeChannel | null = null;
  private isPresenceSubscribed = false;
  private isDbSubscribed = false;
  private hasConnectedDbOnce = false;
  private onDbReconnectedCb: (() => void) | null = null;

  private lobbyObserverClient: SupabaseClient | null = null;
  private lobbyChannel: RealtimeChannel | null = null;
  private lobbyLocalChannel: BroadcastChannel | null = null;
  private lobbyLocalSweepTimer: number | null = null;
  private lobbyLocalEntries = new Map<ProfileId, { entry: OccupiedEntry; lastSeen: number }>();
  private lobbyListeners = new Set<(occupancy: LobbyOccupancy) => void>();
  private currentLobbyOccupancy: LobbyOccupancy = EMPTY_LOBBY_OCCUPANCY;
  private pendingChannelRemoval: Promise<unknown> | null = null;
  private lifecycleToken = 0;

  private localChannel: BroadcastChannel | null = null;
  private localPresenceTimer: number | null = null;
  private idleHeartbeatTimer: number | null = null;
  private syncRetryTimer: number | null = null;
  private joinEchoTimer: number | null = null;
  private watchdogTimer: number | null = null;
  private presenceSweepTimer: number | null = null;
  private presenceReconnectTimer: number | null = null;
  private dbReconnectTimer: number | null = null;
  private presenceReconnectAttempt = 0;
  private dbReconnectAttempt = 0;
  private cleanupWindowListeners: (() => void) | null = null;

  private localPartnerLastSeen = 0;
  private partnerInPresence = false;
  private partnerLastBroadcastAt = 0;
  private partnerLastBroadcastRoom: RoomId = 'kitchen';
  private knownPartnerOnline = false;

  private myProfileId: ProfileId | null = null;
  private myDisplayName = '';
  private myCharacterId: CharacterId = 'bubu';
  private myRoom: RoomId = 'kitchen';
  private activeStationId: StationId | null = null;
  private sessionNonce = makeNonce();

  private seq = 0;
  private lastBroadcastAt = 0;
  private lastSentX = Number.NaN;
  private lastSentZ = Number.NaN;
  private lastSentRotY = Number.NaN;
  private lastSentAnim: AnimState = 'Idle';
  private lastSentRoom: RoomId = 'kitchen';

  private setLobbyOccupancy(next: LobbyOccupancy): void {
    this.currentLobbyOccupancy = next;
    for (const listener of this.lobbyListeners) {
      listener(next);
    }
  }

  public getLobbyOccupancy(): LobbyOccupancy {
    return this.currentLobbyOccupancy;
  }

  /**
   * Read-only presence observer for the login screen (ProfilePinGate).
   * Never calls channel.track(), so unauthenticated viewers never appear as online players.
   */
  public observeLobby(listener: (occupancy: LobbyOccupancy) => void): () => void {
    this.lobbyListeners.add(listener);
    listener(this.currentLobbyOccupancy);

    if (!this.myProfileId && !this.lobbyChannel && !this.lobbyLocalChannel) {
      this.startLobbyObserver();
    }

    return () => {
      this.lobbyListeners.delete(listener);
      if (this.lobbyListeners.size === 0 && !this.myProfileId) {
        void this.stopLobbyObserver();
      }
    };
  }

  public restartLobbyObserver(): void {
    if (this.lobbyListeners.size === 0 || this.myProfileId) return;
    void this.stopLobbyObserver().then(() => {
      if (this.lobbyListeners.size > 0 && !this.myProfileId) {
        this.startLobbyObserver();
      }
    });
  }

  private startLobbyObserver(): void {
    const token = ++this.lifecycleToken;
    this.setLobbyOccupancy(EMPTY_LOBBY_OCCUPANCY);

    const obsClient = createLobbyObserverClient();
    if (obsClient) {
      if (this.lifecycleToken !== token || this.myProfileId || this.lobbyListeners.size === 0) {
        return;
      }
      this.lobbyObserverClient = obsClient;

      // Read-only observer on an isolated socket: NEVER calls channel.track().
      const ch = obsClient.channel(HOME_CHANNEL_NAME, {
        config: {
          broadcast: { self: false, ack: false },
        },
      });

      ch.on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState<PresencePayload>();
        const entries: OccupiedEntry[] = [];
        for (const presences of Object.values(state)) {
          const latest = presences[presences.length - 1];
          if (!latest || !isValidProfileId(latest.profileId)) continue;
          const charId = isValidCharacterId(latest.characterId)
            ? latest.characterId
            : PROFILES[latest.profileId].defaultCharacter;
          entries.push({
            profileId: latest.profileId,
            displayName: latest.displayName || PROFILES[latest.profileId].defaultName,
            characterId: charId,
          });
        }
        this.setLobbyOccupancy(buildLobbyOccupancy(entries));
      });

      ch.subscribe();
      this.lobbyChannel = ch;
      return;
    }

    // Local multi-tab demo mode via BroadcastChannel
    if (typeof BroadcastChannel === 'undefined') return;
    this.lobbyLocalEntries.clear();
    const bc = new BroadcastChannel(LOCAL_BC_NAME);
    this.lobbyLocalChannel = bc;

    const flushLocal = () => {
      const now = Date.now();
      for (const [pid, rec] of this.lobbyLocalEntries.entries()) {
        if (now - rec.lastSeen > 6000) {
          this.lobbyLocalEntries.delete(pid);
        }
      }
      const entries = Array.from(this.lobbyLocalEntries.values()).map((r) => r.entry);
      this.setLobbyOccupancy(buildLobbyOccupancy(entries));
    };

    bc.onmessage = (event: MessageEvent<LocalChannelMsg>) => {
      const msg = event.data;
      if (!msg) return;
      if (msg.type === 'presence_ping') {
        const p = msg.payload;
        if (!isValidProfileId(p.profileId)) return;
        const charId = isValidCharacterId(p.characterId)
          ? p.characterId
          : PROFILES[p.profileId].defaultCharacter;
        this.lobbyLocalEntries.set(p.profileId, {
          entry: {
            profileId: p.profileId,
            displayName: p.displayName || PROFILES[p.profileId].defaultName,
            characterId: charId,
          },
          lastSeen: Date.now(),
        });
        flushLocal();
      } else if (msg.type === 'presence_leave') {
        if (this.lobbyLocalEntries.delete(msg.profileId)) {
          flushLocal();
        }
      }
    };

    bc.postMessage({ type: 'lobby_probe' } satisfies LocalChannelMsg);
    this.lobbyLocalSweepTimer = window.setInterval(flushLocal, 2000);
  }

  public async stopLobbyObserver(): Promise<void> {
    if (
      !this.lobbyChannel &&
      !this.lobbyObserverClient &&
      !this.lobbyLocalChannel &&
      this.lobbyLocalSweepTimer === null
    ) {
      return;
    }
    this.lifecycleToken += 1;
    if (this.lobbyLocalSweepTimer !== null) {
      window.clearInterval(this.lobbyLocalSweepTimer);
      this.lobbyLocalSweepTimer = null;
    }
    if (this.lobbyLocalChannel) {
      this.lobbyLocalChannel.close();
      this.lobbyLocalChannel = null;
    }
    this.lobbyLocalEntries.clear();

    const ch = this.lobbyChannel;
    const obsClient = this.lobbyObserverClient;
    this.lobbyChannel = null;
    this.lobbyObserverClient = null;

    if (obsClient) {
      if (ch) {
        await obsClient.removeChannel(ch).catch(() => undefined);
      }
      await obsClient.realtime.disconnect().catch(() => undefined);
    }
  }

  public connect(
    profileId: ProfileId,
    displayName: string,
    characterId: CharacterId,
    onDbReconnected?: () => void,
  ): void {
    this.disconnect();
    const token = ++this.lifecycleToken;
    this.myProfileId = profileId;
    this.myDisplayName = displayName;
    this.myCharacterId = characterId;
    this.myRoom = useGameStore.getState().currentRoom;
    this.activeStationId = null;
    this.onDbReconnectedCb = onDbReconnected ?? null;
    this.hasConnectedDbOnce = false;
    this.presenceReconnectAttempt = 0;
    this.dbReconnectAttempt = 0;
    this.partnerInPresence = false;
    this.partnerLastBroadcastAt = 0;
    this.partnerLastBroadcastRoom = 'kitchen';
    this.knownPartnerOnline = false;
    this.sessionNonce = makeNonce();
    this.seq = 0;
    this.lastSentX = Number.NaN;

    const supabase = getSupabaseClient();
    if (supabase) {
      const start = () => {
        if (this.lifecycleToken !== token || this.myProfileId !== profileId) return;
        this.subscribePresenceChannel(profileId, token);
        this.subscribeDbChannel(profileId, token);
        this.startSupabaseLifecycleGuards(profileId, token);
      };
      if (this.pendingChannelRemoval) {
        void this.pendingChannelRemoval.finally(start);
      } else {
        start();
      }
    } else {
      this.connectLocalChannel(profileId, displayName, characterId);
    }
  }

  private getPartnerHint(partnerId: ProfileId) {
    if (this.partnerLastBroadcastAt <= 0) return null;
    const gameProf = useGameStore.getState().profiles[partnerId];
    return {
      profileId: partnerId,
      room: this.partnerLastBroadcastRoom,
      lastBroadcastAt: this.partnerLastBroadcastAt,
      displayName: gameProf?.displayName ?? PROFILES[partnerId].defaultName,
      characterId: gameProf?.characterId ?? PROFILES[partnerId].defaultCharacter,
    };
  }

  private ensurePartnerInOnlineProfiles(partnerId: ProfileId, room: RoomId): void {
    const existing = useSessionStore.getState().onlineProfiles;
    const current = existing[partnerId];
    if (current && current.room === room) return;

    const gameProf = useGameStore.getState().profiles[partnerId];
    const nextEntry: PresencePayload = current
      ? { ...current, room }
      : {
          profileId: partnerId,
          displayName: gameProf?.displayName ?? PROFILES[partnerId].defaultName,
          characterId: gameProf?.characterId ?? PROFILES[partnerId].defaultCharacter,
          room,
          onlineAt: new Date().toISOString(),
          activeStationId: null,
        };

    useSessionStore.getState().setOnlineProfiles({
      ...existing,
      [partnerId]: nextEntry,
    });
  }

  private handleExplicitPartnerLeave(leftId: ProfileId): void {
    this.partnerInPresence = false;
    this.partnerLastBroadcastAt = 0;
    const next = { ...useSessionStore.getState().onlineProfiles };
    delete next[leftId];
    useSessionStore.getState().setOnlineProfiles(next);
    playerMotionStore.setRemoteActive(false, null);

    if (this.knownPartnerOnline) {
      this.knownPartnerOnline = false;
      const t = getTranslations(useLanguageStore.getState().lang);
      const fallbackName =
        useGameStore.getState().profiles[leftId]?.displayName ?? PROFILES[leftId].defaultName;
      useGameStore.getState().pushToast(t.partnerLeftToast(fallbackName), 'info');
    }
  }

  private buildPresencePayload(): PresencePayload {
    const loc = playerMotionStore.local;
    return {
      profileId: this.myProfileId!,
      displayName: this.myDisplayName,
      characterId: this.myCharacterId,
      room: this.myRoom,
      onlineAt: new Date().toISOString(),
      activeStationId: this.activeStationId,
      x: Math.round(loc.x * 1000) / 1000,
      z: Math.round(loc.z * 1000) / 1000,
      rotY: Math.round(loc.rotY * 1000) / 1000,
      anim: loc.anim,
    };
  }

  private canPushPresenceBroadcast(): boolean {
    return Boolean(
      this.presenceChannel &&
        this.isPresenceSubscribed &&
        this.presenceChannel.state === 'joined',
    );
  }

  private requestSyncFromPartners(): void {
    if (!this.myProfileId) return;
    if (this.canPushPresenceBroadcast() && this.presenceChannel) {
      void this.presenceChannel.send({
        type: 'broadcast',
        event: 'sync_request',
        payload: { from: this.myProfileId },
      });
    } else if (this.localChannel) {
      this.localChannel.postMessage({
        type: 'sync_request',
        from: this.myProfileId,
      } satisfies LocalChannelMsg);
    }
  }

  private clearIdleHeartbeatTimer(): void {
    if (this.idleHeartbeatTimer !== null) {
      window.clearInterval(this.idleHeartbeatTimer);
      this.idleHeartbeatTimer = null;
    }
  }

  private clearPresenceSubTimers(): void {
    this.clearIdleHeartbeatTimer();
    if (this.syncRetryTimer !== null) {
      window.clearTimeout(this.syncRetryTimer);
      this.syncRetryTimer = null;
    }
    if (this.joinEchoTimer !== null) {
      window.clearTimeout(this.joinEchoTimer);
      this.joinEchoTimer = null;
    }
  }

  private subscribePresenceChannel(profileId: ProfileId, token: number): void {
    const supabase = getSupabaseClient();
    if (!supabase || this.lifecycleToken !== token || this.myProfileId !== profileId) return;

    if (this.presenceReconnectTimer !== null) {
      window.clearTimeout(this.presenceReconnectTimer);
      this.presenceReconnectTimer = null;
    }

    if (this.presenceChannel) {
      const old = this.presenceChannel;
      this.presenceChannel = null;
      this.isPresenceSubscribed = false;
      void supabase.removeChannel(old).catch(() => undefined);
    }

    useSessionStore
      .getState()
      .setConnectionStatus(this.presenceReconnectAttempt > 0 ? 'connecting' : 'connecting');

    const channel = supabase.channel(HOME_CHANNEL_NAME, {
      config: {
        broadcast: { self: false, ack: false },
        presence: { key: profileId },
      },
    });

    // 1. Realtime Broadcast: player position/facing/anim/room (NEVER written to Postgres)
    channel.on('broadcast', { event: 'player_state' }, ({ payload }) => {
      if (this.presenceChannel !== channel || this.lifecycleToken !== token) return;
      const data = payload as BroadcastPlayerPayload;
      if (!data || data.profileId === this.myProfileId) return;
      const room = data.room ?? 'kitchen';
      this.partnerLastBroadcastAt = Date.now();
      this.partnerLastBroadcastRoom = room;
      playerMotionStore.applyRemotePacket(
        data.profileId,
        data.sessionNonce ?? 'legacy',
        room,
        data.x,
        data.z,
        data.rotY,
        data.anim,
        data.seq,
      );
      this.ensurePartnerInOnlineProfiles(data.profileId, room);
    });

    // 1b. Handshake: reply strictly with Broadcast state (do NOT call track() to avoid Presence churn)
    channel.on('broadcast', { event: 'sync_request' }, ({ payload }) => {
      if (this.presenceChannel !== channel || this.lifecycleToken !== token) return;
      const data = payload as { from?: ProfileId } | undefined;
      if (!data?.from || data.from === this.myProfileId) return;
      this.sendImmediateState();
    });

    // 1c. Explicit sign-out notification for instant cleanup
    channel.on('broadcast', { event: 'player_leave' }, ({ payload }) => {
      if (this.presenceChannel !== channel || this.lifecycleToken !== token) return;
      const data = payload as { profileId?: ProfileId } | undefined;
      if (!data?.profileId || data.profileId === this.myProfileId) return;
      this.handleExplicitPartnerLeave(data.profileId);
    });

    // 2. Realtime Presence: online status, room, character & initial coordinates snapshot
    channel.on('presence', { event: 'sync' }, () => {
      if (this.presenceChannel !== channel || this.lifecycleToken !== token) return;
      const state = channel.presenceState<PresencePayload>();
      const presenceMap: Partial<Record<ProfileId, PresencePayload>> = {};
      let partnerEntry: PresencePayload | null = null;

      for (const entries of Object.values(state)) {
        const latest = entries[entries.length - 1];
        if (!latest || !latest.profileId) continue;
        presenceMap[latest.profileId] = latest;
        if (latest.profileId !== profileId) {
          partnerEntry = latest;
        }
      }

      this.partnerInPresence = Boolean(partnerEntry);
      const partnerId: ProfileId = profileId === 'p1' ? 'p2' : 'p1';
      const reconciled = reconcileOnlineProfiles({
        myProfileId: profileId,
        presenceMap,
        existingOnline: useSessionStore.getState().onlineProfiles,
        partnerHint: this.getPartnerHint(partnerId),
        nowMs: Date.now(),
        graceMs: PARTNER_BROADCAST_GRACE_MS,
      });

      useSessionStore.getState().setOnlineProfiles(reconciled.onlineProfiles);

      if (partnerEntry) {
        const resolvedRoom = reconciled.onlineProfiles[partnerId]?.room ?? partnerEntry.room ?? 'kitchen';
        playerMotionStore.seedRemoteFromPresence(
          partnerEntry.profileId,
          resolvedRoom,
          partnerEntry.x,
          partnerEntry.z,
          partnerEntry.rotY,
          partnerEntry.anim,
        );
      } else if (!reconciled.partnerVisible) {
        playerMotionStore.setRemoteActive(false, null);
      }
    });

    channel.on('presence', { event: 'join' }, ({ currentPresences, newPresences }) => {
      if (this.presenceChannel !== channel || this.lifecycleToken !== token) return;
      if (!isInitialPresenceJoin(currentPresences.length, newPresences.length)) return;

      const t = getTranslations(useLanguageStore.getState().lang);
      for (const p of newPresences as unknown as PresencePayload[]) {
        if (p.profileId && p.profileId !== profileId) {
          if (!this.knownPartnerOnline) {
            this.knownPartnerOnline = true;
            useGameStore.getState().pushToast(t.partnerJoinedToast(p.displayName), 'success');
          }
          // Reply right away and again after 500ms so late joiner never misses our position
          this.sendImmediateState();
          if (this.joinEchoTimer !== null) {
            window.clearTimeout(this.joinEchoTimer);
          }
          this.joinEchoTimer = window.setTimeout(() => {
            this.joinEchoTimer = null;
            if (this.presenceChannel === channel && this.lifecycleToken === token) {
              this.sendImmediateState();
            }
          }, 500);
        }
      }
    });

    channel.on('presence', { event: 'leave' }, ({ currentPresences, leftPresences }) => {
      if (this.presenceChannel !== channel || this.lifecycleToken !== token) return;
      // Ignore meta replacement events emitted by channel.track()
      if (!isFinalPresenceLeave(currentPresences.length)) return;

      const t = getTranslations(useLanguageStore.getState().lang);
      for (const p of leftPresences as unknown as PresencePayload[]) {
        if (p.profileId && p.profileId !== profileId) {
          this.partnerInPresence = false;
          // Only notify/expire immediately if Broadcast isn't still flowing; otherwise sweep handles it
          if (shouldExpirePartner(false, this.partnerLastBroadcastAt, Date.now(), PARTNER_BROADCAST_GRACE_MS)) {
            if (this.knownPartnerOnline) {
              this.knownPartnerOnline = false;
              useGameStore.getState().pushToast(t.partnerLeftToast(p.displayName), 'info');
            }
          }
        }
      }
    });

    this.presenceChannel = channel;

    channel.subscribe(async (status) => {
      if (this.presenceChannel !== channel || this.lifecycleToken !== token || this.myProfileId !== profileId) {
        return;
      }

      if (status === 'SUBSCRIBED') {
        this.isPresenceSubscribed = true;
        this.presenceReconnectAttempt = 0;
        useSessionStore.getState().setConnectionStatus('connected');

        await channel.track(this.buildPresencePayload()).catch(() => undefined);
        if (this.presenceChannel !== channel || this.lifecycleToken !== token) return;

        this.sendImmediateState();
        this.requestSyncFromPartners();

        this.clearPresenceSubTimers();
        this.syncRetryTimer = window.setTimeout(() => {
          this.syncRetryTimer = null;
          if (this.presenceChannel === channel && this.lifecycleToken === token && !playerMotionStore.remote.initialized) {
            this.requestSyncFromPartners();
          }
        }, 1200);

        // Gentle low-frequency Broadcast heartbeat (0.4 Hz, 0 DB writes)
        this.idleHeartbeatTimer = window.setInterval(() => {
          this.sendImmediateState();
        }, IDLE_HEARTBEAT_MS);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        this.isPresenceSubscribed = false;
        this.clearPresenceSubTimers();
        useSessionStore.getState().setConnectionStatus('connecting');
        this.schedulePresenceReconnect(profileId, token);
      }
    });
  }

  private schedulePresenceReconnect(profileId: ProfileId, token: number): void {
    if (this.lifecycleToken !== token || this.myProfileId !== profileId) return;
    if (this.presenceReconnectTimer !== null) return;

    const idx = Math.min(this.presenceReconnectAttempt, RECONNECT_BACKOFF_MS.length - 1);
    const delay = RECONNECT_BACKOFF_MS[idx];
    this.presenceReconnectAttempt += 1;

    this.presenceReconnectTimer = window.setTimeout(() => {
      this.presenceReconnectTimer = null;
      if (this.lifecycleToken !== token || this.myProfileId !== profileId) return;
      const supabase = getSupabaseClient();
      if (supabase && !supabase.realtime.isConnected()) {
        supabase.realtime.connect();
      }
      this.subscribePresenceChannel(profileId, token);
    }, delay);
  }

  private subscribeDbChannel(profileId: ProfileId, token: number): void {
    const supabase = getSupabaseClient();
    if (!supabase || this.lifecycleToken !== token || this.myProfileId !== profileId) return;

    if (this.dbReconnectTimer !== null) {
      window.clearTimeout(this.dbReconnectTimer);
      this.dbReconnectTimer = null;
    }

    if (this.dbChannel) {
      const old = this.dbChannel;
      this.dbChannel = null;
      this.isDbSubscribed = false;
      void supabase.removeChannel(old).catch(() => undefined);
    }

    const channel = supabase.channel(DB_CHANNEL_NAME);

    // 3. Postgres Changes: persistent home state + live profile/character updates (isolated from Presence)
    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          const row = payload.new as {
            id?: ProfileId;
            display_name?: string;
            avatar_color?: string;
            character_id?: CharacterId;
          };
          if (row?.id === 'p1' || row?.id === 'p2') {
            useGameStore.getState().patchProfile({
              id: row.id,
              displayName: row.display_name ?? PROFILES[row.id].defaultName,
              avatarColor: row.avatar_color ?? PROFILES[row.id].avatarColor,
              characterId: row.character_id ?? PROFILES[row.id].defaultCharacter,
            });
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'home_state' },
        (payload) => {
          const row = payload.new as
            | {
                coins?: number;
                restaurant_open?: boolean;
                served_orders_count?: number;
                service_streak?: number;
                last_order_spawned_at?: string | null;
              }
            | undefined;
          if (!row) return;
          if (typeof row.coins === 'number') {
            useGameStore.getState().setCoins(row.coins);
          }
          useGameStore.getState().patchRestaurantMeta({
            restaurantOpen:
              typeof row.restaurant_open === 'boolean' ? row.restaurant_open : undefined,
            servedOrdersCount:
              typeof row.served_orders_count === 'number'
                ? row.served_orders_count
                : undefined,
            serviceStreak:
              typeof row.service_streak === 'number' ? row.service_streak : undefined,
            lastOrderSpawnedAt:
              row.last_order_spawned_at !== undefined
                ? row.last_order_spawned_at
                : undefined,
          });
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
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'restaurant_orders' },
        (payload) => {
          const row = payload.new as {
            id?: string;
            table_id?: TableId;
            recipe_id?: RecipeId;
            difficulty?: RecipeDifficulty;
            customer_name?: string;
            customer_avatar?: CustomerAvatarId;
            status?: OrderStatus;
            created_at?: string;
            expires_at?: string;
            delivered_at?: string | null;
            served_by?: ProfileId | null;
            reward_coins?: number;
            tip_coins?: number;
          };
          if (!row?.id || !row.table_id || !row.recipe_id) return;
          useGameStore.getState().upsertOrder({
            id: row.id,
            tableId: row.table_id,
            recipeId: row.recipe_id,
            difficulty: row.difficulty ?? RECIPES[row.recipe_id].difficulty,
            customerName: row.customer_name ?? 'Misafir',
            customerAvatar: row.customer_avatar ?? 'cust_fox',
            status: row.status ?? 'waiting',
            createdAt: row.created_at ?? new Date().toISOString(),
            expiresAt: row.expires_at ?? new Date().toISOString(),
            deliveredAt: row.delivered_at ?? null,
            servedBy: row.served_by ?? null,
            rewardCoins: Number(row.reward_coins ?? 0),
            tipCoins: Number(row.tip_coins ?? 0),
          });
        },
      );

    this.dbChannel = channel;

    channel.subscribe((status) => {
      if (this.dbChannel !== channel || this.lifecycleToken !== token || this.myProfileId !== profileId) {
        return;
      }

      if (status === 'SUBSCRIBED') {
        this.isDbSubscribed = true;
        this.dbReconnectAttempt = 0;
        if (this.hasConnectedDbOnce) {
          this.onDbReconnectedCb?.();
        }
        this.hasConnectedDbOnce = true;
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        this.isDbSubscribed = false;
        this.scheduleDbReconnect(profileId, token);
      }
    });
  }

  private scheduleDbReconnect(profileId: ProfileId, token: number): void {
    if (this.lifecycleToken !== token || this.myProfileId !== profileId) return;
    if (this.dbReconnectTimer !== null) return;

    const idx = Math.min(this.dbReconnectAttempt, RECONNECT_BACKOFF_MS.length - 1);
    const delay = RECONNECT_BACKOFF_MS[idx];
    this.dbReconnectAttempt += 1;

    this.dbReconnectTimer = window.setTimeout(() => {
      this.dbReconnectTimer = null;
      if (this.lifecycleToken !== token || this.myProfileId !== profileId) return;
      this.subscribeDbChannel(profileId, token);
    }, delay);
  }

  private startSupabaseLifecycleGuards(profileId: ProfileId, token: number): void {
    const checkHealthAndResync = (fromWakeEvent: boolean) => {
      if (this.lifecycleToken !== token || this.myProfileId !== profileId) return;
      const supabase = getSupabaseClient();
      if (!supabase) return;

      const socketOk = supabase.realtime.isConnected();
      const presenceJoined =
        this.isPresenceSubscribed &&
        this.presenceChannel !== null &&
        this.presenceChannel.state === 'joined';

      if (!socketOk || !presenceJoined) {
        if (!socketOk) {
          supabase.realtime.connect();
        }
        if (this.presenceReconnectTimer === null) {
          this.subscribePresenceChannel(profileId, token);
        }
      } else {
        const state = this.presenceChannel?.presenceState<PresencePayload>() ?? {};
        const selfTracked = Boolean(state[profileId]?.length);
        if (!selfTracked || fromWakeEvent) {
          this.trackPresence();
        }
        if (fromWakeEvent) {
          this.sendImmediateState();
          this.requestSyncFromPartners();
        }
      }

      const dbJoined =
        this.isDbSubscribed && this.dbChannel !== null && this.dbChannel.state === 'joined';
      if (!dbJoined && this.dbReconnectTimer === null) {
        this.subscribeDbChannel(profileId, token);
      }
    };

    this.watchdogTimer = window.setInterval(() => {
      checkHealthAndResync(false);
    }, WATCHDOG_INTERVAL_MS);

    this.presenceSweepTimer = window.setInterval(() => {
      if (this.lifecycleToken !== token || this.myProfileId !== profileId) return;
      const partnerId: ProfileId = profileId === 'p1' ? 'p2' : 'p1';
      const online = useSessionStore.getState().onlineProfiles;
      if (!online[partnerId]) return;

      if (
        shouldExpirePartner(
          this.partnerInPresence,
          this.partnerLastBroadcastAt,
          Date.now(),
          PARTNER_BROADCAST_GRACE_MS,
        )
      ) {
        const next = { ...online };
        const leftName =
          next[partnerId]?.displayName ??
          useGameStore.getState().profiles[partnerId]?.displayName ??
          PROFILES[partnerId].defaultName;
        delete next[partnerId];
        useSessionStore.getState().setOnlineProfiles(next);
        playerMotionStore.setRemoteActive(false, null);
        if (this.knownPartnerOnline) {
          this.knownPartnerOnline = false;
          const t = getTranslations(useLanguageStore.getState().lang);
          useGameStore.getState().pushToast(t.partnerLeftToast(leftName), 'info');
        }
      }
    }, SWEEP_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkHealthAndResync(true);
      }
    };
    const onPageShow = () => checkHealthAndResync(true);
    const onOnline = () => checkHealthAndResync(true);

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('online', onOnline);

    this.cleanupWindowListeners = () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('online', onOnline);
    };
  }

  private connectLocalChannel(
    profileId: ProfileId,
    _displayName: string,
    _characterId: CharacterId,
  ): void {
    useSessionStore.getState().setConnectionStatus('connected');
    useSessionStore.getState().setOnlineProfiles({ [profileId]: this.buildPresencePayload() });

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
        this.partnerLastBroadcastAt = Date.now();
        this.partnerLastBroadcastRoom = d.room ?? 'kitchen';
        const room = d.room ?? 'kitchen';
        playerMotionStore.applyRemotePacket(
          d.profileId,
          d.sessionNonce ?? 'local',
          room,
          d.x,
          d.z,
          d.rotY,
          d.anim,
          d.seq,
        );
        this.ensurePartnerInOnlineProfiles(d.profileId, room);
      } else if (msg.type === 'sync_request') {
        if (msg.from === this.myProfileId) return;
        this.sendImmediateState();
      } else if (msg.type === 'lobby_probe') {
        this.trackPresence();
      } else if (msg.type === 'presence_ping') {
        const p = msg.payload;
        if (p.profileId === this.myProfileId) return;
        const wasOnline = Boolean(useSessionStore.getState().onlineProfiles[p.profileId]);
        this.localPartnerLastSeen = Date.now();
        useSessionStore.getState().setOnlineProfiles({
          ...useSessionStore.getState().onlineProfiles,
          [p.profileId]: p,
        });
        playerMotionStore.seedRemoteFromPresence(
          p.profileId,
          p.room ?? 'kitchen',
          p.x,
          p.z,
          p.rotY,
          p.anim,
        );
        if (!wasOnline) {
          const t = getTranslations(useLanguageStore.getState().lang);
          useGameStore.getState().pushToast(t.partnerJoinedToast(p.displayName), 'success');
          this.sendImmediateState();
        }
      } else if (msg.type === 'presence_leave' || msg.type === 'player_leave') {
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
      this.localChannel.postMessage({
        type: 'presence_ping',
        payload: this.buildPresencePayload(),
      } satisfies LocalChannelMsg);

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
    this.requestSyncFromPartners();
    this.localPresenceTimer = window.setInterval(emitPresence, 2000);
  }

  private trackPresence(): void {
    if (!this.myProfileId) return;
    const payload = this.buildPresencePayload();

    if (this.canPushPresenceBroadcast() && this.presenceChannel) {
      void this.presenceChannel.track(payload).catch(() => undefined);
    } else if (this.localChannel) {
      this.localChannel.postMessage({ type: 'presence_ping', payload } satisfies LocalChannelMsg);
    }
  }

  public updatePresenceRoom(room: RoomId): void {
    this.myRoom = room;
    this.trackPresence();
    this.sendImmediateState();
  }

  public updatePresenceStation(stationId: StationId | null): void {
    this.activeStationId = stationId;
    this.trackPresence();
  }

  public sendImmediateState(): void {
    const loc = playerMotionStore.local;
    this.maybeBroadcastMotion(loc.room, loc.x, loc.z, loc.rotY, loc.anim, true);
  }

  public maybeBroadcastMotion(
    room: RoomId,
    x: number,
    z: number,
    rotY: number,
    anim: AnimState,
    force = false,
  ): void {
    if (!this.myProfileId) return;

    const now = performance.now();
    const animChanged = anim !== this.lastSentAnim || room !== this.lastSentRoom;
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
    this.lastSentRoom = room;
    this.seq += 1;

    const payload: BroadcastPlayerPayload = {
      profileId: this.myProfileId,
      sessionNonce: this.sessionNonce,
      room,
      x: Math.round(x * 1000) / 1000,
      z: Math.round(z * 1000) / 1000,
      rotY: Math.round(rotY * 1000) / 1000,
      anim,
      seq: this.seq,
      ts: Date.now(),
    };

    if (this.canPushPresenceBroadcast() && this.presenceChannel) {
      void this.presenceChannel.send({
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
    this.lifecycleToken += 1;

    if (this.cleanupWindowListeners) {
      this.cleanupWindowListeners();
      this.cleanupWindowListeners = null;
    }

    if (this.lobbyLocalSweepTimer !== null) {
      window.clearInterval(this.lobbyLocalSweepTimer);
      this.lobbyLocalSweepTimer = null;
    }
    if (this.lobbyLocalChannel) {
      this.lobbyLocalChannel.close();
      this.lobbyLocalChannel = null;
    }
    this.lobbyLocalEntries.clear();

    if (this.lobbyObserverClient || this.lobbyChannel) {
      const lobbyCh = this.lobbyChannel;
      const obsClient = this.lobbyObserverClient;
      this.lobbyChannel = null;
      this.lobbyObserverClient = null;
      if (obsClient) {
        void (lobbyCh ? obsClient.removeChannel(lobbyCh).catch(() => undefined) : Promise.resolve())
          .finally(() => {
            void obsClient.realtime.disconnect().catch(() => undefined);
          });
      }
    }

    if (this.localPresenceTimer !== null) {
      window.clearInterval(this.localPresenceTimer);
      this.localPresenceTimer = null;
    }
    this.clearPresenceSubTimers();
    if (this.watchdogTimer !== null) {
      window.clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.presenceSweepTimer !== null) {
      window.clearInterval(this.presenceSweepTimer);
      this.presenceSweepTimer = null;
    }
    if (this.presenceReconnectTimer !== null) {
      window.clearTimeout(this.presenceReconnectTimer);
      this.presenceReconnectTimer = null;
    }
    if (this.dbReconnectTimer !== null) {
      window.clearTimeout(this.dbReconnectTimer);
      this.dbReconnectTimer = null;
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

    const supabase = getSupabaseClient();
    const channelsToRemove: RealtimeChannel[] = [];
    if (this.presenceChannel) {
      const ch = this.presenceChannel;
      if (this.myProfileId && this.canPushPresenceBroadcast()) {
        void ch.send({
          type: 'broadcast',
          event: 'player_leave',
          payload: { profileId: this.myProfileId },
        });
        void ch.untrack().catch(() => undefined);
      }
      this.isPresenceSubscribed = false;
      this.presenceChannel = null;
      channelsToRemove.push(ch);
    }
    if (this.dbChannel) {
      const dbCh = this.dbChannel;
      this.isDbSubscribed = false;
      this.dbChannel = null;
      channelsToRemove.push(dbCh);
    }

    if (supabase && channelsToRemove.length > 0) {
      const removal = Promise.all(
        channelsToRemove.map((ch) => supabase.removeChannel(ch).catch(() => undefined)),
      );
      this.pendingChannelRemoval = removal;
      void removal.finally(() => {
        if (this.pendingChannelRemoval === removal) {
          this.pendingChannelRemoval = null;
        }
      });
    }

    this.myProfileId = null;
    this.onDbReconnectedCb = null;
    this.partnerInPresence = false;
    this.partnerLastBroadcastAt = 0;
    this.knownPartnerOnline = false;
    this.setLobbyOccupancy(EMPTY_LOBBY_OCCUPANCY);
    playerMotionStore.setRemoteActive(false, null);
    useSessionStore.getState().setConnectionStatus('disconnected');
  }
}

export const kitchenRealtime = new KitchenRealtimeSync();

export function broadcastLocalSnapshot(snapshot: HomeSnapshot): void {
  kitchenRealtime.postLocalSnapshot(snapshot);
}
