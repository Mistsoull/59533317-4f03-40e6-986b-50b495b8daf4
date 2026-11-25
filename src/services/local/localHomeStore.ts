import type { CharacterId } from '../../config/characters';
import { COOKED_ITEMS } from '../../config/ingredients';
import { PROFILES, type ProfileId } from '../../config/profiles';
import { RECIPES, type RecipeId } from '../../config/recipes';
import type { StationId } from '../../config/kitchenLayout';
import {
  DELIVERING_FINALIZE_SECONDS,
  SERVER_SPAWN_COOLDOWN_SECONDS,
  calculateServePayout,
  evaluateOrderPatience,
  type SpawnCandidate,
} from '../../domain/restaurantRules';
import type { HomeSnapshot, RestaurantOrderRow } from '../supabase/types';

const STORAGE_KEY = 'cozy_kitchen_local_home_v2';

function createSeedSnapshot(): HomeSnapshot {
  return {
    coins: 120,
    restaurantOpen: false,
    servedOrdersCount: 0,
    serviceStreak: 0,
    lastOrderSpawnedAt: null,
    profiles: {
      p1: {
        id: 'p1',
        displayName: PROFILES.p1.defaultName,
        avatarColor: PROFILES.p1.avatarColor,
        characterId: PROFILES.p1.defaultCharacter,
      },
      p2: {
        id: 'p2',
        displayName: PROFILES.p2.defaultName,
        avatarColor: PROFILES.p2.avatarColor,
        characterId: PROFILES.p2.defaultCharacter,
      },
    },
    inventory: {
      domates: 2,
      biber: 2,
      yumurta: 3,
      mantar: 1,
      makarna: 1,
      krema: 1,
      cilek: 1,
      un: 1,
      sut: 1,
    },
    stations: {
      fridge: {
        id: 'fridge',
        status: 'idle',
        activeRecipeId: null,
        stationPayload: {},
        lockedBy: null,
        lockExpiresAt: null,
      },
      cutting_board: {
        id: 'cutting_board',
        status: 'idle',
        activeRecipeId: null,
        stationPayload: {},
        lockedBy: null,
        lockExpiresAt: null,
      },
      stove: {
        id: 'stove',
        status: 'idle',
        activeRecipeId: null,
        stationPayload: {},
        lockedBy: null,
        lockExpiresAt: null,
      },
    },
    recipes: {
      menemen: {
        recipeId: 'menemen',
        inGameCookCount: 0,
        irlCookedCount: 0,
        irlConfirmedP1: false,
        irlConfirmedP2: false,
        irlLastCookedAt: null,
        irlNote: null,
      },
      mantarli_makarna: {
        recipeId: 'mantarli_makarna',
        inGameCookCount: 0,
        irlCookedCount: 0,
        irlConfirmedP1: false,
        irlConfirmedP2: false,
        irlLastCookedAt: null,
        irlNote: null,
      },
      pankek: {
        recipeId: 'pankek',
        inGameCookCount: 0,
        irlCookedCount: 0,
        irlConfirmedP1: false,
        irlConfirmedP2: false,
        irlLastCookedAt: null,
        irlNote: null,
      },
    },
    orders: [],
  };
}

function makeOrderId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function readLocalHome(): HomeSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = createSeedSnapshot();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as HomeSnapshot;
    const now = Date.now();
    for (const st of Object.values(parsed.stations)) {
      if (st.lockedBy && st.lockExpiresAt && new Date(st.lockExpiresAt).getTime() < now) {
        st.lockedBy = null;
        st.lockExpiresAt = null;
        if (st.status === 'in_use') st.status = 'idle';
      }
    }
    if (!parsed.profiles.p1.characterId) parsed.profiles.p1.characterId = 'bubu';
    if (!parsed.profiles.p2.characterId) parsed.profiles.p2.characterId = 'dudu';
    if (typeof parsed.restaurantOpen !== 'boolean') parsed.restaurantOpen = false;
    if (typeof parsed.servedOrdersCount !== 'number') parsed.servedOrdersCount = 0;
    if (typeof parsed.serviceStreak !== 'number') parsed.serviceStreak = 0;
    if (parsed.lastOrderSpawnedAt === undefined) parsed.lastOrderSpawnedAt = null;
    if (!Array.isArray(parsed.orders)) parsed.orders = [];
    return parsed;
  } catch {
    return createSeedSnapshot();
  }
}

export function writeLocalHome(snapshot: HomeSnapshot): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota errors
  }
}

export function localUpdateProfile(
  profileId: ProfileId,
  displayName: string,
  characterId: CharacterId,
): HomeSnapshot {
  const snapshot = readLocalHome();
  const cleanName = displayName.trim().slice(0, 20) || PROFILES[profileId].defaultName;
  snapshot.profiles[profileId] = {
    ...snapshot.profiles[profileId],
    displayName: cleanName,
    characterId,
  };
  writeLocalHome(snapshot);
  return snapshot;
}

export function localAcquireLock(
  stationId: StationId,
  profileId: ProfileId,
  ttlSeconds = 25,
): { acquired: boolean; lockedBy: ProfileId | null; lockExpiresAt: string | null; snapshot: HomeSnapshot } {
  const snapshot = readLocalHome();
  const st = snapshot.stations[stationId];
  const now = Date.now();
  const expired = !st.lockExpiresAt || new Date(st.lockExpiresAt).getTime() < now;

  if (!st.lockedBy || st.lockedBy === profileId || expired) {
    st.lockedBy = profileId;
    st.lockExpiresAt = new Date(now + ttlSeconds * 1000).toISOString();
    if (st.status === 'idle') st.status = 'in_use';
    writeLocalHome(snapshot);
    return {
      acquired: true,
      lockedBy: st.lockedBy,
      lockExpiresAt: st.lockExpiresAt,
      snapshot,
    };
  }

  return {
    acquired: false,
    lockedBy: st.lockedBy,
    lockExpiresAt: st.lockExpiresAt,
    snapshot,
  };
}

export function localHeartbeatLock(
  stationId: StationId,
  profileId: ProfileId,
  ttlSeconds = 25,
): HomeSnapshot | null {
  const snapshot = readLocalHome();
  const st = snapshot.stations[stationId];
  if (st.lockedBy !== profileId) return null;
  st.lockExpiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  writeLocalHome(snapshot);
  return snapshot;
}

export function localReleaseLock(stationId: StationId, profileId: ProfileId): HomeSnapshot {
  const snapshot = readLocalHome();
  const st = snapshot.stations[stationId];
  if (st.lockedBy === profileId || !st.lockedBy) {
    st.lockedBy = null;
    st.lockExpiresAt = null;
    if (st.status === 'in_use') st.status = 'idle';
    writeLocalHome(snapshot);
  }
  return snapshot;
}

export function localBuyIngredient(
  itemId: string,
  qty: number,
  unitPrice: number,
): { ok: boolean; errorCode?: string; snapshot: HomeSnapshot } {
  const snapshot = readLocalHome();
  const total = qty * unitPrice;
  if (snapshot.coins < total) {
    return { ok: false, errorCode: 'INSUFFICIENT_COINS', snapshot };
  }
  snapshot.coins -= total;
  snapshot.inventory[itemId] = (snapshot.inventory[itemId] ?? 0) + qty;
  writeLocalHome(snapshot);
  return { ok: true, snapshot };
}

export function localClaimPantrySupport(): { ok: boolean; snapshot: HomeSnapshot } {
  const snapshot = readLocalHome();
  const hasCooked = COOKED_ITEMS.some((d) => (snapshot.inventory[d.id] ?? 0) > 0);
  if (snapshot.coins >= 30 || hasCooked) {
    return { ok: false, snapshot };
  }
  snapshot.coins += 50;
  writeLocalHome(snapshot);
  return { ok: true, snapshot };
}

export function localCompletePrep(
  profileId: ProfileId,
  rawItemId: string,
  preppedItemId: string,
): { ok: boolean; errorCode?: string; snapshot: HomeSnapshot } {
  const snapshot = readLocalHome();
  const rawQty = snapshot.inventory[rawItemId] ?? 0;
  if (rawQty < 1) {
    return { ok: false, errorCode: 'MISSING_RAW_ITEM', snapshot };
  }
  snapshot.inventory[rawItemId] = rawQty - 1;
  snapshot.inventory[preppedItemId] = (snapshot.inventory[preppedItemId] ?? 0) + 1;
  const st = snapshot.stations.cutting_board;
  st.lockedBy = null;
  st.lockExpiresAt = null;
  st.status = 'idle';
  st.stationPayload = { lastPrepped: preppedItemId, by: profileId, at: new Date().toISOString() };
  writeLocalHome(snapshot);
  return { ok: true, snapshot };
}

export function localCompleteCook(
  profileId: ProfileId,
  recipeId: RecipeId,
  requirements: readonly { itemId: string; qty: number }[],
): { ok: boolean; errorCode?: string; snapshot: HomeSnapshot } {
  const snapshot = readLocalHome();
  for (const req of requirements) {
    if ((snapshot.inventory[req.itemId] ?? 0) < req.qty) {
      return { ok: false, errorCode: `MISSING_INGREDIENT:${req.itemId}`, snapshot };
    }
  }
  for (const req of requirements) {
    snapshot.inventory[req.itemId] = (snapshot.inventory[req.itemId] ?? 0) - req.qty;
  }
  const cookedItemId = RECIPES[recipeId].cookedItemId;
  snapshot.inventory[cookedItemId] = (snapshot.inventory[cookedItemId] ?? 0) + 1;
  snapshot.recipes[recipeId].inGameCookCount += 1;
  const st = snapshot.stations.stove;
  st.lockedBy = null;
  st.lockExpiresAt = null;
  st.status = 'ready';
  st.activeRecipeId = recipeId;
  st.stationPayload = {
    lastCooked: recipeId,
    cookedItemId,
    by: profileId,
    at: new Date().toISOString(),
  };
  writeLocalHome(snapshot);
  return { ok: true, snapshot };
}

export function localSellCookedDish(
  cookedItemId: string,
  qty: number,
  unitPrice: number,
): { ok: boolean; errorCode?: string; snapshot: HomeSnapshot } {
  const snapshot = readLocalHome();
  const have = snapshot.inventory[cookedItemId] ?? 0;
  if (qty <= 0 || unitPrice <= 0 || have < qty) {
    return { ok: false, errorCode: 'MISSING_COOKED_DISH', snapshot };
  }
  snapshot.inventory[cookedItemId] = have - qty;
  snapshot.coins += qty * unitPrice;
  writeLocalHome(snapshot);
  return { ok: true, snapshot };
}

export function localSetRestaurantOpen(open: boolean): HomeSnapshot {
  const snapshot = readLocalHome();
  snapshot.restaurantOpen = open;
  if (open) {
    snapshot.lastOrderSpawnedAt = null;
  }
  writeLocalHome(snapshot);
  return snapshot;
}

export function localExpireRestaurantOrders(): {
  expiredCount: number;
  finalizedCount: number;
  snapshot: HomeSnapshot;
} {
  const snapshot = readLocalHome();
  const now = Date.now();
  let expiredCount = 0;
  let finalizedCount = 0;
  const kept: RestaurantOrderRow[] = [];

  for (const order of snapshot.orders) {
    if (order.status === 'delivering') {
      const delMs = order.deliveredAt ? new Date(order.deliveredAt).getTime() : 0;
      if (delMs > 0 && now - delMs >= DELIVERING_FINALIZE_SECONDS * 1000) {
        finalizedCount += 1;
        continue;
      }
      kept.push(order);
    } else if (order.status === 'waiting') {
      if (new Date(order.expiresAt).getTime() <= now) {
        expiredCount += 1;
        continue;
      }
      kept.push(order);
    }
  }

  if (expiredCount > 0) {
    snapshot.serviceStreak = 0;
  }

  if (expiredCount > 0 || finalizedCount > 0 || kept.length !== snapshot.orders.length) {
    snapshot.orders = kept;
    writeLocalHome(snapshot);
  }

  return { expiredCount, finalizedCount, snapshot };
}

export function localSpawnRestaurantOrder(
  candidate: SpawnCandidate,
  maxActiveOrders: number,
): { ok: boolean; order?: RestaurantOrderRow; errorCode?: string; snapshot: HomeSnapshot } {
  const cleaned = localExpireRestaurantOrders();
  const snapshot = cleaned.snapshot;
  if (!snapshot.restaurantOpen) {
    return { ok: false, errorCode: 'RESTAURANT_CLOSED', snapshot };
  }

  const now = Date.now();
  if (
    snapshot.lastOrderSpawnedAt &&
    now - new Date(snapshot.lastOrderSpawnedAt).getTime() < SERVER_SPAWN_COOLDOWN_SECONDS * 1000
  ) {
    return { ok: false, errorCode: 'COOLDOWN', snapshot };
  }

  const active = snapshot.orders.filter(
    (o) => o.status === 'waiting' || o.status === 'delivering',
  );
  if (active.length >= Math.min(3, Math.max(1, maxActiveOrders))) {
    return { ok: false, errorCode: 'TABLE_LIMIT', snapshot };
  }
  if (active.some((o) => o.tableId === candidate.tableId)) {
    return { ok: false, errorCode: 'TABLE_OCCUPIED', snapshot };
  }

  const newOrder: RestaurantOrderRow = {
    id: makeOrderId(),
    tableId: candidate.tableId,
    recipeId: candidate.recipeId,
    difficulty: candidate.difficulty,
    customerName: candidate.customerName,
    customerAvatar: candidate.customerAvatar,
    status: 'waiting',
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + candidate.durationSeconds * 1000).toISOString(),
    deliveredAt: null,
    servedBy: null,
    rewardCoins: 0,
    tipCoins: 0,
  };

  snapshot.orders = [...active, newOrder];
  snapshot.lastOrderSpawnedAt = new Date(now).toISOString();
  writeLocalHome(snapshot);
  return { ok: true, order: newOrder, snapshot };
}

export function localServeRestaurantOrder(
  profileId: ProfileId,
  orderId: string,
): {
  ok: boolean;
  rewardCoins: number;
  tipCoins: number;
  errorCode?: string;
  snapshot: HomeSnapshot;
} {
  const snapshot = readLocalHome();
  const now = Date.now();
  const idx = snapshot.orders.findIndex((o) => o.id === orderId);
  if (idx === -1) {
    return { ok: false, rewardCoins: 0, tipCoins: 0, errorCode: 'ORDER_NOT_FOUND', snapshot };
  }

  const order = snapshot.orders[idx];
  if (order.status !== 'waiting') {
    return {
      ok: false,
      rewardCoins: 0,
      tipCoins: 0,
      errorCode: 'ORDER_ALREADY_HANDLED',
      snapshot,
    };
  }

  const patience = evaluateOrderPatience(order.createdAt, order.expiresAt, now);
  if (patience.isExpired) {
    snapshot.orders = snapshot.orders.filter((o) => o.id !== orderId);
    snapshot.serviceStreak = 0;
    writeLocalHome(snapshot);
    return { ok: false, rewardCoins: 0, tipCoins: 0, errorCode: 'ORDER_EXPIRED', snapshot };
  }

  const recipe = RECIPES[order.recipeId];
  const have = snapshot.inventory[recipe.cookedItemId] ?? 0;
  if (have < 1) {
    return {
      ok: false,
      rewardCoins: 0,
      tipCoins: 0,
      errorCode: 'MISSING_COOKED_DISH',
      snapshot,
    };
  }

  const payout = calculateServePayout(recipe, patience.ratio);
  snapshot.inventory[recipe.cookedItemId] = have - 1;
  snapshot.coins += payout.totalCoins;
  snapshot.servedOrdersCount += 1;
  snapshot.serviceStreak += 1;

  snapshot.orders[idx] = {
    ...order,
    status: 'delivering',
    deliveredAt: new Date(now).toISOString(),
    servedBy: profileId,
    rewardCoins: payout.rewardCoins,
    tipCoins: payout.tipCoins,
  };
  writeLocalHome(snapshot);

  return {
    ok: true,
    rewardCoins: payout.rewardCoins,
    tipCoins: payout.tipCoins,
    snapshot,
  };
}

export function localCompleteRestaurantOrder(orderId: string): HomeSnapshot {
  const snapshot = readLocalHome();
  const next = snapshot.orders.filter((o) => o.id !== orderId);
  if (next.length !== snapshot.orders.length) {
    snapshot.orders = next;
    writeLocalHome(snapshot);
  }
  return snapshot;
}

export function localConfirmRecipeIrl(
  profileId: ProfileId,
  recipeId: RecipeId,
  note: string | null,
  resetCycle: boolean,
): { ok: boolean; bothConfirmed: boolean; bonusCoins: number; snapshot: HomeSnapshot } {
  const snapshot = readLocalHome();
  const row = snapshot.recipes[recipeId];
  let bonus = 0;

  if (resetCycle) {
    row.irlConfirmedP1 = profileId === 'p1';
    row.irlConfirmedP2 = profileId === 'p2';
    row.irlCookedCount += 1;
    bonus = 30;
  } else if (profileId === 'p1' && !row.irlConfirmedP1) {
    row.irlConfirmedP1 = true;
    if (!row.irlConfirmedP2) {
      row.irlCookedCount += 1;
      bonus = 30;
    } else {
      bonus = 50;
    }
  } else if (profileId === 'p2' && !row.irlConfirmedP2) {
    row.irlConfirmedP2 = true;
    if (!row.irlConfirmedP1) {
      row.irlCookedCount += 1;
      bonus = 30;
    } else {
      bonus = 50;
    }
  }

  row.irlLastCookedAt = new Date().toISOString();
  if (note && note.trim()) {
    row.irlNote = note.trim();
  }
  snapshot.coins += bonus;
  writeLocalHome(snapshot);

  return {
    ok: true,
    bothConfirmed: row.irlConfirmedP1 && row.irlConfirmedP2,
    bonusCoins: bonus,
    snapshot,
  };
}
