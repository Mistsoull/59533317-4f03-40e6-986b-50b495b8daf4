import type { CharacterId } from '../../config/characters';
import { PROFILES, type ProfileId } from '../../config/profiles';
import { RECIPES, type RecipeDifficulty, type RecipeId, type RecipeRequirement } from '../../config/recipes';
import type { StationId } from '../../config/kitchenLayout';
import type { CustomerAvatarId, TableId } from '../../config/restaurantLayout';
import {
  calculateClockOffsetMs,
  type OrderStatus,
  type SpawnCandidate,
} from '../../domain/restaurantRules';
import { getSupabaseClient } from './client';
import {
  localAcquireLock,
  localBuyIngredient,
  localClaimPantrySupport,
  localCompleteCook,
  localCompletePrep,
  localCompleteRestaurantOrder,
  localConfirmRecipeIrl,
  localExpireRestaurantOrders,
  localHeartbeatLock,
  localReleaseLock,
  localSellCookedDish,
  localServeRestaurantOrder,
  localSetRestaurantOpen,
  localSpawnRestaurantOrder,
  localUpdateProfile,
  readLocalHome,
} from '../local/localHomeStore';
import { broadcastLocalSnapshot } from './realtimeSync';
import type {
  HomeSnapshot,
  ProfileRow,
  RecipeProgressRow,
  RestaurantOrderRow,
  StationStateRow,
} from './types';
import { useGameStore } from '../../store/useGameStore';

function sanitizeDisplayName(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  return raw
    .replaceAll('Åž', 'Ş')
    .replaceAll('ÄŸ', 'ğ')
    .replaceAll('Ã¼', 'ü')
    .replaceAll('Ã¶', 'ö')
    .replaceAll('Ã§', 'ç')
    .replaceAll('Ä±', 'ı');
}

function mapOrderRow(row: Record<string, unknown>): RestaurantOrderRow | null {
  const id = row.id as string | undefined;
  const tableId = row.table_id as TableId | undefined;
  const recipeId = row.recipe_id as RecipeId | undefined;
  if (!id || !tableId || !recipeId) return null;
  return {
    id,
    tableId,
    recipeId,
    difficulty: (row.difficulty as RecipeDifficulty) ?? RECIPES[recipeId].difficulty,
    customerName: sanitizeDisplayName(row.customer_name as string | undefined, 'Misafir'),
    customerAvatar: (row.customer_avatar as CustomerAvatarId) ?? 'cust_fox',
    status: (row.status as OrderStatus) ?? 'waiting',
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    expiresAt: (row.expires_at as string) ?? new Date().toISOString(),
    deliveredAt: (row.delivered_at as string | null) ?? null,
    servedBy: (row.served_by as ProfileId | null) ?? null,
    rewardCoins: Number(row.reward_coins ?? 0),
    tipCoins: Number(row.tip_coins ?? 0),
  };
}

function updateClockOffsetFromServer(
  serverNowIso: string | null | undefined,
  reqStartMs: number,
  resEndMs: number,
): void {
  if (!serverNowIso) return;
  const serverMs = new Date(serverNowIso).getTime();
  if (!Number.isFinite(serverMs)) return;
  const offset = calculateClockOffsetMs(serverMs, reqStartMs, resEndMs);
  useGameStore.getState().setClockOffsetMs(offset);
}

export async function fetchHomeSnapshot(silentExpireOnBoot = false): Promise<HomeSnapshot> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    if (silentExpireOnBoot) {
      localExpireRestaurantOrders();
    }
    const localSnap = readLocalHome();
    useGameStore.getState().setClockOffsetMs(0);
    useGameStore.getState().applySnapshot(localSnap);
    return localSnap;
  }

  // Silently clean up any stale expired/delivering orders on fresh session boot
  if (silentExpireOnBoot) {
    const t0 = Date.now();
    const { data: expData } = await supabase.rpc('expire_restaurant_orders');
    const t1 = Date.now();
    if (Array.isArray(expData) && expData.length > 0) {
      const row = expData[0] as { server_now?: string };
      updateClockOffsetFromServer(row.server_now, t0, t1);
    }
  }

  const clockReqStart = Date.now();
  const [homeRes, profilesRes, invRes, stationsRes, recipesRes, ordersRes, serverTimeRes] =
    await Promise.all([
      supabase.from('home_state').select('*').eq('id', 'home').single(),
      supabase.from('profiles').select('*'),
      supabase.from('home_inventory').select('*'),
      supabase.from('kitchen_stations').select('*'),
      supabase.from('recipe_progress').select('*'),
      supabase
        .from('restaurant_orders')
        .select('*')
        .in('status', ['waiting', 'delivering'])
        .order('created_at', { ascending: true }),
      supabase.rpc('get_server_time'),
    ]);
  const clockReqEnd = Date.now();

  if (typeof serverTimeRes.data === 'string') {
    updateClockOffsetFromServer(serverTimeRes.data, clockReqStart, clockReqEnd);
  }

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

  const orders: RestaurantOrderRow[] = [];
  for (const rawOrder of ordersRes.data ?? []) {
    const mapped = mapOrderRow(rawOrder as Record<string, unknown>);
    if (mapped) orders.push(mapped);
  }

  const snapshot: HomeSnapshot = {
    coins: Number(homeRes.data?.coins ?? 120),
    restaurantOpen: Boolean(homeRes.data?.restaurant_open ?? false),
    servedOrdersCount: Number(homeRes.data?.served_orders_count ?? 0),
    serviceStreak: Number(homeRes.data?.service_streak ?? 0),
    lastOrderSpawnedAt: (homeRes.data?.last_order_spawned_at as string | null) ?? null,
    profiles,
    inventory,
    stations,
    recipes,
    orders,
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
    const res = localCompleteCook(profileId, recipeId, requirements);
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

export async function sellCookedDish(
  cookedItemId: string,
  qty: number,
  unitPrice: number,
): Promise<{ ok: boolean; errorCode?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const res = localSellCookedDish(cookedItemId, qty, unitPrice);
    useGameStore.getState().applySnapshot(res.snapshot);
    broadcastLocalSnapshot(res.snapshot);
    return { ok: res.ok, errorCode: res.errorCode };
  }

  const { data, error } = await supabase.rpc('sell_cooked_dish', {
    p_cooked_item_id: cookedItemId,
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
    useGameStore.getState().patchInventoryItem(cookedItemId, row.new_quantity);
  }
  return { ok: row.ok, errorCode: row.error_code ?? undefined };
}

export async function setRestaurantOpen(open: boolean): Promise<{ ok: boolean }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const snap = localSetRestaurantOpen(open);
    useGameStore.getState().applySnapshot(snap);
    broadcastLocalSnapshot(snap);
    return { ok: true };
  }

  const t0 = Date.now();
  const { data, error } = await supabase.rpc('set_restaurant_open', {
    p_open: open,
  });
  const t1 = Date.now();

  if (error || !Array.isArray(data) || data.length === 0) {
    return { ok: false };
  }
  const row = data[0] as { ok: boolean; restaurant_open: boolean; server_now?: string };
  updateClockOffsetFromServer(row.server_now, t0, t1);
  if (row.ok) {
    useGameStore.getState().patchRestaurantMeta({
      restaurantOpen: Boolean(row.restaurant_open),
      lastOrderSpawnedAt: row.restaurant_open ? null : undefined,
    });
  }
  return { ok: Boolean(row.ok) };
}

export async function spawnRestaurantOrder(
  candidate: SpawnCandidate,
  maxActiveOrders: number,
): Promise<{ ok: boolean; errorCode?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const res = localSpawnRestaurantOrder(candidate, maxActiveOrders);
    useGameStore.getState().applySnapshot(res.snapshot);
    broadcastLocalSnapshot(res.snapshot);
    return { ok: res.ok, errorCode: res.errorCode };
  }

  const t0 = Date.now();
  const { data, error } = await supabase.rpc('spawn_restaurant_order', {
    p_table_id: candidate.tableId,
    p_recipe_id: candidate.recipeId,
    p_difficulty: candidate.difficulty,
    p_customer_name: candidate.customerName,
    p_customer_avatar: candidate.customerAvatar,
    p_duration_seconds: candidate.durationSeconds,
    p_max_active_orders: maxActiveOrders,
  });
  const t1 = Date.now();

  if (error || !Array.isArray(data) || data.length === 0) {
    return { ok: false, errorCode: 'RPC_ERROR' };
  }

  const row = data[0] as {
    ok: boolean;
    order_id: string | null;
    server_now?: string;
    error_code: string | null;
  };
  updateClockOffsetFromServer(row.server_now, t0, t1);
  if (row.ok) {
    // Refresh active orders immediately in case Postgres Changes arrives slightly later
    const { data: activeRows } = await supabase
      .from('restaurant_orders')
      .select('*')
      .in('status', ['waiting', 'delivering'])
      .order('created_at', { ascending: true });
    if (activeRows) {
      const mapped = activeRows
        .map((r) => mapOrderRow(r as Record<string, unknown>))
        .filter((x): x is RestaurantOrderRow => x !== null);
      useGameStore.getState().setOrders(mapped);
    }
  }
  return { ok: Boolean(row.ok), errorCode: row.error_code ?? undefined };
}

export async function serveRestaurantOrder(
  profileId: ProfileId,
  orderId: string,
  recipeId: RecipeId,
): Promise<{
  ok: boolean;
  rewardCoins: number;
  tipCoins: number;
  errorCode?: string;
}> {
  const recipe = RECIPES[recipeId];
  const supabase = getSupabaseClient();
  if (!supabase) {
    const res = localServeRestaurantOrder(profileId, orderId);
    useGameStore.getState().applySnapshot(res.snapshot);
    broadcastLocalSnapshot(res.snapshot);
    return {
      ok: res.ok,
      rewardCoins: res.rewardCoins,
      tipCoins: res.tipCoins,
      errorCode: res.errorCode,
    };
  }

  const t0 = Date.now();
  const { data, error } = await supabase.rpc('serve_restaurant_order', {
    p_order_id: orderId,
    p_base_reward: recipe.rewardCoins,
    p_tip_rate: recipe.tipRate,
  });
  const t1 = Date.now();

  if (error || !Array.isArray(data) || data.length === 0) {
    return { ok: false, rewardCoins: 0, tipCoins: 0, errorCode: 'RPC_ERROR' };
  }

  const row = data[0] as {
    ok: boolean;
    reward_coins: number;
    tip_coins: number;
    new_coins: number;
    service_streak: number;
    server_now?: string;
    error_code: string | null;
  };
  updateClockOffsetFromServer(row.server_now, t0, t1);

  if (row.ok) {
    const state = useGameStore.getState();
    state.setCoins(row.new_coins);
    state.patchRestaurantMeta({
      serviceStreak: row.service_streak,
      servedOrdersCount: state.servedOrdersCount + 1,
    });
    const invQty = state.inventory[recipe.cookedItemId] ?? 1;
    state.patchInventoryItem(recipe.cookedItemId, Math.max(0, invQty - 1));
    const existing = state.orders.find((o) => o.id === orderId);
    if (existing) {
      state.upsertOrder({
        ...existing,
        status: 'delivering',
        deliveredAt: row.server_now ?? new Date().toISOString(),
        servedBy: profileId,
        rewardCoins: row.reward_coins,
        tipCoins: row.tip_coins,
      });
    }
  } else if (row.error_code === 'ORDER_EXPIRED') {
    const existing = useGameStore.getState().orders.find((o) => o.id === orderId);
    if (existing) {
      useGameStore.getState().upsertOrder({ ...existing, status: 'expired' });
    }
    useGameStore.getState().patchRestaurantMeta({ serviceStreak: 0 });
  }

  return {
    ok: Boolean(row.ok),
    rewardCoins: Number(row.reward_coins ?? 0),
    tipCoins: Number(row.tip_coins ?? 0),
    errorCode: row.error_code ?? undefined,
  };
}

export async function completeRestaurantOrder(orderId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const snap = localCompleteRestaurantOrder(orderId);
    useGameStore.getState().applySnapshot(snap);
    broadcastLocalSnapshot(snap);
    return;
  }

  await supabase.rpc('complete_restaurant_order', { p_order_id: orderId });
  const existing = useGameStore.getState().orders.find((o) => o.id === orderId);
  if (existing) {
    useGameStore.getState().upsertOrder({ ...existing, status: 'served' });
  }
}

export async function expireRestaurantOrders(): Promise<{
  expiredCount: number;
  finalizedCount: number;
}> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    const res = localExpireRestaurantOrders();
    if (res.expiredCount > 0 || res.finalizedCount > 0) {
      useGameStore.getState().applySnapshot(res.snapshot);
      broadcastLocalSnapshot(res.snapshot);
    }
    return { expiredCount: res.expiredCount, finalizedCount: res.finalizedCount };
  }

  const t0 = Date.now();
  const { data, error } = await supabase.rpc('expire_restaurant_orders');
  const t1 = Date.now();

  if (error || !Array.isArray(data) || data.length === 0) {
    return { expiredCount: 0, finalizedCount: 0 };
  }

  const row = data[0] as {
    expired_count: number;
    finalized_count: number;
    service_streak: number;
    server_now?: string;
  };
  updateClockOffsetFromServer(row.server_now, t0, t1);

  if (row.expired_count > 0 || row.finalized_count > 0) {
    useGameStore.getState().patchRestaurantMeta({ serviceStreak: row.service_streak });
    const { data: activeRows } = await supabase
      .from('restaurant_orders')
      .select('*')
      .in('status', ['waiting', 'delivering'])
      .order('created_at', { ascending: true });
    if (activeRows) {
      const mapped = activeRows
        .map((r) => mapOrderRow(r as Record<string, unknown>))
        .filter((x): x is RestaurantOrderRow => x !== null);
      useGameStore.getState().setOrders(mapped);
    }
  }

  return {
    expiredCount: Number(row.expired_count ?? 0),
    finalizedCount: Number(row.finalized_count ?? 0),
  };
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
