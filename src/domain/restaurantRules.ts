import type { ProfileId } from '../config/profiles';
import { RECIPES, RECIPE_LIST, type RecipeDef, type RecipeDifficulty, type RecipeId } from '../config/recipes';
import {
  CUSTOMER_PRESETS,
  RESTAURANT_TABLE_LIST,
  type CustomerAvatarId,
  type TableId,
} from '../config/restaurantLayout';

export type OrderStatus = 'waiting' | 'delivering' | 'served' | 'expired';
export type PatienceLevel = 'happy' | 'impatient' | 'urgent' | 'expired';

export interface RestaurantOrderView {
  id: string;
  tableId: TableId;
  recipeId: RecipeId;
  difficulty: RecipeDifficulty;
  customerName: string;
  customerAvatar: CustomerAvatarId;
  status: OrderStatus;
  createdAt: string;
  expiresAt: string;
  deliveredAt: string | null;
  servedBy: ProfileId | null;
  rewardCoins: number;
  tipCoins: number;
}

export const SOLO_DURATION_MULTIPLIER = 1.35;
export const SERVER_SPAWN_COOLDOWN_SECONDS = 8;
export const DELIVERING_FINALIZE_SECONDS = 11;

/**
 * Delivery timer scales by recipe difficulty and gives solo players +35% breathing room.
 */
export function computeDeliveryDurationSeconds(
  recipe: Pick<RecipeDef, 'baseDeliverySeconds'>,
  onlinePlayerCount: number,
): number {
  const safeCount = Math.max(1, onlinePlayerCount);
  const multiplier = safeCount <= 1 ? SOLO_DURATION_MULTIPLIER : 1;
  return Math.round(recipe.baseDeliverySeconds * multiplier);
}

/**
 * Active table cap scales cleanly: 1 player -> max 2 tables, 2 players -> max 3 tables.
 */
export function computeMaxActiveTables(onlinePlayerCount: number): number {
  return onlinePlayerCount >= 2 ? 3 : 2;
}

/**
 * Deterministic Presence host election with strict `p1` priority.
 * Ensures only one connected client drives periodic customer spawn & expiration ticks.
 */
export function electRestaurantHost(
  onlineProfileIds: readonly ProfileId[],
  myProfileId: ProfileId | null,
): boolean {
  if (!myProfileId) return false;
  if (onlineProfileIds.includes('p1')) {
    return myProfileId === 'p1';
  }
  if (onlineProfileIds.includes('p2')) {
    return myProfileId === 'p2';
  }
  return true;
}

/**
 * Computes clock skew offset (`serverNow - clientNow`) using midpoint RTT compensation.
 */
export function calculateClockOffsetMs(
  serverNowMs: number,
  requestStartMs: number,
  responseEndMs: number,
): number {
  const midpointClientMs = (requestStartMs + responseEndMs) / 2;
  return Math.round(serverNowMs - midpointClientMs);
}

export interface OrderPatienceSnapshot {
  remainingMs: number;
  totalMs: number;
  /** Remaining fraction in [0, 1] */
  ratio: number;
  level: PatienceLevel;
  isExpired: boolean;
}

export function evaluateOrderPatience(
  createdAtIso: string,
  expiresAtIso: string,
  nowMs: number,
): OrderPatienceSnapshot {
  const createdMs = new Date(createdAtIso).getTime();
  const expiresMs = new Date(expiresAtIso).getTime();
  const totalMs = Math.max(1000, expiresMs - createdMs);
  const remainingMs = Math.max(0, expiresMs - nowMs);
  const ratio = Math.max(0, Math.min(1, remainingMs / totalMs));

  let level: PatienceLevel;
  if (remainingMs <= 0) {
    level = 'expired';
  } else if (ratio > 0.5) {
    level = 'happy';
  } else if (ratio >= 0.2) {
    level = 'impatient';
  } else {
    level = 'urgent';
  }

  return {
    remainingMs,
    totalMs,
    ratio,
    level,
    isExpired: remainingMs <= 0,
  };
}

export interface ServePayout {
  rewardCoins: number;
  tipCoins: number;
  totalCoins: number;
  patienceLevel: PatienceLevel;
}

/**
 * Cozy Mode payout curve:
 *  - >50% patience left: 100% reward + full tipRate bonus
 *  - 20%-50% left: 100% reward, 0 tip
 *  - <20% left: 85% reward, 0 tip
 *  - 0% (expired): 0 coins, NO coin penalty
 */
export function calculateServePayout(
  recipe: Pick<RecipeDef, 'rewardCoins' | 'tipRate'>,
  remainingRatio: number,
): ServePayout {
  if (remainingRatio <= 0) {
    return { rewardCoins: 0, tipCoins: 0, totalCoins: 0, patienceLevel: 'expired' };
  }
  if (remainingRatio > 0.5) {
    const tipCoins = Math.round(recipe.rewardCoins * recipe.tipRate);
    return {
      rewardCoins: recipe.rewardCoins,
      tipCoins,
      totalCoins: recipe.rewardCoins + tipCoins,
      patienceLevel: 'happy',
    };
  }
  if (remainingRatio >= 0.2) {
    return {
      rewardCoins: recipe.rewardCoins,
      tipCoins: 0,
      totalCoins: recipe.rewardCoins,
      patienceLevel: 'impatient',
    };
  }
  const rewardCoins = Math.round(recipe.rewardCoins * 0.85);
  return {
    rewardCoins,
    tipCoins: 0,
    totalCoins: rewardCoins,
    patienceLevel: 'urgent',
  };
}

export interface SpawnCandidate {
  tableId: TableId;
  recipeId: RecipeId;
  difficulty: RecipeDifficulty;
  durationSeconds: number;
  customerAvatar: CustomerAvatarId;
  customerName: string;
}

/**
 * Selects an unoccupied table, recipe, and cute customer preset if active table limit allows.
 */
export function pickNextSpawnCandidate(
  activeOrders: readonly Pick<RestaurantOrderView, 'tableId' | 'status' | 'recipeId'>[],
  onlinePlayerCount: number,
  lang: 'tr' | 'de' = 'tr',
  randomFn: () => number = Math.random,
): SpawnCandidate | null {
  const occupiedOrders = activeOrders.filter(
    (o) => o.status === 'waiting' || o.status === 'delivering',
  );
  const maxTables = computeMaxActiveTables(onlinePlayerCount);
  if (occupiedOrders.length >= maxTables) {
    return null;
  }

  const occupiedTables = new Set(occupiedOrders.map((o) => o.tableId));
  const freeTables = RESTAURANT_TABLE_LIST.filter((t) => !occupiedTables.has(t.id));
  if (freeTables.length === 0) return null;

  const table = freeTables[Math.floor(randomFn() * freeTables.length) % freeTables.length];
  const recipe = RECIPE_LIST[Math.floor(randomFn() * RECIPE_LIST.length) % RECIPE_LIST.length];
  const preset =
    CUSTOMER_PRESETS[Math.floor(randomFn() * CUSTOMER_PRESETS.length) % CUSTOMER_PRESETS.length];

  return {
    tableId: table.id,
    recipeId: recipe.id,
    difficulty: recipe.difficulty,
    durationSeconds: computeDeliveryDurationSeconds(recipe, onlinePlayerCount),
    customerAvatar: preset.avatar,
    customerName: lang === 'de' ? preset.nameDe : preset.nameTr,
  };
}

/**
 * Finds the most urgent (earliest expiring) waiting order matching a given recipeId.
 */
export function findMatchingWaitingOrder(
  orders: readonly RestaurantOrderView[],
  recipeId: RecipeId,
  nowMs: number,
): RestaurantOrderView | null {
  let best: RestaurantOrderView | null = null;
  let bestExp = Infinity;

  for (const order of orders) {
    if (order.status !== 'waiting' || order.recipeId !== recipeId) continue;
    const expMs = new Date(order.expiresAt).getTime();
    if (expMs <= nowMs) continue;
    if (expMs < bestExp) {
      bestExp = expMs;
      best = order;
    }
  }
  return best;
}

export function getCookedItemCountForRecipe(
  inventory: Record<string, number>,
  recipeId: RecipeId,
): number {
  return inventory[RECIPES[recipeId].cookedItemId] ?? 0;
}

export function formatRemainingTime(remainingMs: number): string {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
