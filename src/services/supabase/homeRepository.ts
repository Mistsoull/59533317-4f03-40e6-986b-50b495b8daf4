import type { CharacterId } from '../../config/characters';
import { PROFILES, type ProfileId } from '../../config/profiles';
import type { RecipeId, RecipeRequirement } from '../../config/recipes';
import type { StationId } from '../../config/kitchenLayout';
import { getSupabaseClient } from './client';
import {
  localAcquireLock,
  localBuyIngredient,
  localClaimPantrySupport,
  localCompleteCook,
  localCompletePrep,
  localConfirmRecipeIrl,
  localHeartbeatLock,
  localReleaseLock,
  localUpdateProfile,
  readLocalHome,
} from '../local/localHomeStore';
import { broadcastLocalSnapshot } from './realtimeSync';
import type {
  HomeSnapshot,
  ProfileRow,
  RecipeProgressRow,
  StationStateRow,
} from './types';
import { useGameStore } from '../../store/useGameStore';

function sanitizeDisplayName(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  return raw.replaceAll('Åž', 'Ş').replaceAll('ÄŸ', 'ğ').replaceAll('Ã¼', 'ü').replaceAll('Ã¶', 'ö').replaceAll('Ã§', 'ç').replaceAll('Ä±', 'ı');
}

export async function fetchHomeSnapshot(): Promise<HomeSnapshot> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const localSnap = readLocalHome();
    useGameStore.getState().applySnapshot(localSnap);
    return localSnap;
  }

  const [homeRes, profilesRes, invRes, stationsRes, recipesRes] = await Promise.all([
    supabase.from('home_state').select('*').eq('id', 'home').single(),
    supabase.from('profiles').select('*'),
    supabase.from('home_inventory').select('*'),
    supabase.from('kitchen_stations').select('*'),
    supabase.from('recipe_progress').select('*'),
  ]);

  const fallback = readLocalHome();

  const profiles: Record<ProfileId, ProfileRow> = { ...fallback.profiles };
  for (const row of profilesRes.data ?? []) {
    const id = row.id as ProfileId;
    if (id === 'p1' || id === 'p2') {
      profiles[id] = {
        id,
        displayName: sanitizeDisplayName(row.display_name, PROFILES[id].defaultName),
        avatarColor: row.avatar_color ?? PROFILES[id].avatarColor,
        characterId: (row.character_id as CharacterId) ?? PROFILES[id].defaultCharacter,
      };
    }
  }

  const inventory: Record<string, number> = {};
  for (const row of invRes.data ?? []) {
    inventory[row.item_id as string] = Number(row.quantity ?? 0);
  }

  const stations: Record<StationId, StationStateRow> = { ...fallback.stations };
  for (const row of stationsRes.data ?? []) {
    const id = row.id as StationId;
    stations[id] = {
      id,
      status: row.status ?? 'idle',
      activeRecipeId: row.active_recipe_id ?? null,
      stationPayload: (row.station_payload as Record<string, unknown>) ?? {},
      lockedBy: (row.locked_by as ProfileId | null) ?? null,
      lockExpiresAt: row.lock_expires_at ?? null,
    };
  }

  const recipes: Record<RecipeId, RecipeProgressRow> = { ...fallback.recipes };
  for (const row of recipesRes.data ?? []) {
    const id = row.recipe_id as RecipeId;
    recipes[id] = {
      recipeId: id,
      inGameCookCount: Number(row.in_game_cook_count ?? 0),
      irlCookedCount: Number(row.irl_cooked_count ?? 0),
      irlConfirmedP1: Boolean(row.irl_confirmed_p1),
      irlConfirmedP2: Boolean(row.irl_confirmed_p2),
      irlLastCookedAt: row.irl_last_cooked_at ?? null,
      irlNote: row.irl_note ?? null,
    };
  }

  const snapshot: HomeSnapshot = {
    coins: Number(homeRes.data?.coins ?? 120),
    profiles,
    inventory,
    stations,
    recipes,
  };

  useGameStore.getState().applySnapshot(snapshot);
  return snapshot;
}

export async function updateMyProfile(
  profileId: ProfileId,
  displayName: string,
  characterId: CharacterId,
): Promise<ProfileRow> {
  const cleanName = displayName.trim().slice(0, 20) || PROFILES[profileId].defaultName;
  const supabase = getSupabaseClient();

  if (!supabase) {
    const snap = localUpdateProfile(profileId, cleanName, characterId);
    useGameStore.getState().applySnapshot(snap);
    broadcastLocalSnapshot(snap);
    return snap.profiles[profileId];
  }

  const { data, error } = await supabase.rpc('update_my_profile', {
    p_display_name: cleanName,
    p_character_id: characterId,
  });

  if (!error && Array.isArray(data) && data.length > 0) {
    const row = data[0] as {
      id: ProfileId;
      display_name: string;
      avatar_color: string;
      character_id: CharacterId;
    };
    const updated: ProfileRow = {
      id: row.id,
      displayName: row.display_name,
      avatarColor: row.avatar_color,
      characterId: row.character_id,
    };
    useGameStore.getState().patchProfile(updated);
    return updated;
  }

  const fallbackRow: ProfileRow = {
    id: profileId,
    displayName: cleanName,
    avatarColor: PROFILES[profileId].avatarColor,
    characterId,
  };
  useGameStore.getState().patchProfile(fallbackRow);
  return fallbackRow;
}

export async function acquireStationLock(
  stationId: StationId,
  profileId: ProfileId,
  ttlSeconds = 25,
): Promise<{ acquired: boolean; lockedBy: ProfileId | null }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const res = localAcquireLock(stationId, profileId, ttlSeconds);
    useGameStore.getState().applySnapshot(res.snapshot);
    broadcastLocalSnapshot(res.snapshot);
    return { acquired: res.acquired, lockedBy: res.lockedBy };
  }

  const { data, error } = await supabase.rpc('acquire_station_lock', {
    p_station_id: stationId,
    p_ttl_seconds: ttlSeconds,
  });

  if (error || !Array.isArray(data) || data.length === 0) {
    return { acquired: false, lockedBy: null };
  }

  const row = data[0] as {
    acquired: boolean;
    locked_by: ProfileId | null;
    lock_expires_at: string | null;
  };
  const current = useGameStore.getState().stations[stationId];
  useGameStore.getState().patchStation({
    ...current,
    lockedBy: row.locked_by,
    lockExpiresAt: row.lock_expires_at,
    status: row.acquired && current.status === 'idle' ? 'in_use' : current.status,
  });

  return { acquired: Boolean(row.acquired), lockedBy: row.locked_by };
}

export async function heartbeatStationLock(
  stationId: StationId,
  profileId: ProfileId,
  ttlSeconds = 25,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const snap = localHeartbeatLock(stationId, profileId, ttlSeconds);
    if (snap) broadcastLocalSnapshot(snap);
    return;
  }
  await supabase.rpc('heartbeat_station_lock', {
    p_station_id: stationId,
    p_ttl_seconds: ttlSeconds,
  });
}

export async function releaseStationLock(
  stationId: StationId,
  profileId: ProfileId,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const snap = localReleaseLock(stationId, profileId);
    useGameStore.getState().applySnapshot(snap);
    broadcastLocalSnapshot(snap);
    return;
  }

  await supabase.rpc('release_station_lock', { p_station_id: stationId });
  const current = useGameStore.getState().stations[stationId];
  if (current.lockedBy === profileId) {
    useGameStore.getState().patchStation({
      ...current,
      lockedBy: null,
      lockExpiresAt: null,
      status: current.status === 'in_use' ? 'idle' : current.status,
    });
  }
}

export async function buyIngredient(
  itemId: string,
  qty: number,
  unitPrice: number,
): Promise<{ ok: boolean; errorCode?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const res = localBuyIngredient(itemId, qty, unitPrice);
    useGameStore.getState().applySnapshot(res.snapshot);
    broadcastLocalSnapshot(res.snapshot);
    return { ok: res.ok, errorCode: res.errorCode };
  }

  const { data, error } = await supabase.rpc('buy_ingredient', {
    p_item_id: itemId,
    p_qty: qty,
    p_unit_price: unitPrice,
  });

  if (error || !Array.isArray(data) || data.length === 0) {
    return { ok: false, errorCode: 'RPC_ERROR' };
  }

  const row = data[0] as {
    ok: boolean;
    new_coins: number;
    new_quantity: number;
    error_code: string | null;
  };
  if (row.ok) {
    useGameStore.getState().setCoins(row.new_coins);
    useGameStore.getState().patchInventoryItem(itemId, row.new_quantity);
  }
  return { ok: row.ok, errorCode: row.error_code ?? undefined };
}

export async function claimPantrySupport(): Promise<{ ok: boolean }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const res = localClaimPantrySupport();
    useGameStore.getState().applySnapshot(res.snapshot);
    broadcastLocalSnapshot(res.snapshot);
    return { ok: res.ok };
  }

  const { data, error } = await supabase.rpc('claim_pantry_support');
  if (error || !Array.isArray(data) || data.length === 0) {
    return { ok: false };
  }
  const row = data[0] as { ok: boolean; new_coins: number };
  if (row.ok) {
    useGameStore.getState().setCoins(row.new_coins);
  }
  return { ok: row.ok };
}

export async function completePrep(
  profileId: ProfileId,
  rawItemId: string,
  preppedItemId: string,
): Promise<{ ok: boolean; errorCode?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const res = localCompletePrep(profileId, rawItemId, preppedItemId);
    useGameStore.getState().applySnapshot(res.snapshot);
    broadcastLocalSnapshot(res.snapshot);
    return { ok: res.ok, errorCode: res.errorCode };
  }

  const { data, error } = await supabase.rpc('complete_prep', {
    p_raw_item_id: rawItemId,
    p_prepped_item_id: preppedItemId,
  });

  if (error || !Array.isArray(data) || data.length === 0) {
    return { ok: false, errorCode: 'RPC_ERROR' };
  }

  const row = data[0] as { ok: boolean; prepped_qty: number; error_code: string | null };
  if (row.ok) {
    const inv = useGameStore.getState().inventory;
    useGameStore.getState().patchInventoryItem(rawItemId, (inv[rawItemId] ?? 1) - 1);
    useGameStore.getState().patchInventoryItem(preppedItemId, row.prepped_qty);
  }
  return { ok: row.ok, errorCode: row.error_code ?? undefined };
}

export async function completeCook(
  profileId: ProfileId,
  recipeId: RecipeId,
  requirements: readonly RecipeRequirement[],
  rewardCoins: number,
): Promise<{ ok: boolean; errorCode?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const res = localCompleteCook(profileId, recipeId, requirements, rewardCoins);
    useGameStore.getState().applySnapshot(res.snapshot);
    broadcastLocalSnapshot(res.snapshot);
    return { ok: res.ok, errorCode: res.errorCode };
  }

  const { data, error } = await supabase.rpc('complete_cook', {
    p_recipe_id: recipeId,
    p_required_items: requirements,
    p_reward_coins: rewardCoins,
  });

  if (error || !Array.isArray(data) || data.length === 0) {
    return { ok: false, errorCode: 'RPC_ERROR' };
  }

  const row = data[0] as {
    ok: boolean;
    error_code: string | null;
  };
  if (row.ok) {
    await fetchHomeSnapshot();
  }
  return { ok: row.ok, errorCode: row.error_code ?? undefined };
}

export async function confirmRecipeIrl(
  profileId: ProfileId,
  recipeId: RecipeId,
  note: string | null,
  resetCycle: boolean,
): Promise<{ ok: boolean; bothConfirmed: boolean }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const res = localConfirmRecipeIrl(profileId, recipeId, note, resetCycle);
    useGameStore.getState().applySnapshot(res.snapshot);
    broadcastLocalSnapshot(res.snapshot);
    return { ok: res.ok, bothConfirmed: res.bothConfirmed };
  }

  const { data, error } = await supabase.rpc('confirm_recipe_irl', {
    p_recipe_id: recipeId,
    p_note: note,
    p_reset_cycle: resetCycle,
  });

  if (error || !Array.isArray(data) || data.length === 0) {
    return { ok: false, bothConfirmed: false };
  }

  const row = data[0] as {
    ok: boolean;
    both_confirmed: boolean;
  };
  if (row.ok) {
    await fetchHomeSnapshot();
  }
  return { ok: row.ok, bothConfirmed: Boolean(row.both_confirmed) };
}
