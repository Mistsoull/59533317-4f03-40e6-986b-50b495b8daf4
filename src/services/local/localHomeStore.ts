import { PROFILES, type ProfileId } from '../../config/profiles';
import type { RecipeId } from '../../config/recipes';
import type { StationId } from '../../config/kitchenLayout';
import type { HomeSnapshot } from '../supabase/types';

const STORAGE_KEY = 'cozy_kitchen_local_home_v1';

function createSeedSnapshot(): HomeSnapshot {
  return {
    coins: 120,
    profiles: {
      p1: {
        id: 'p1',
        displayName: PROFILES.p1.defaultName,
        avatarColor: PROFILES.p1.avatarColor,
      },
      p2: {
        id: 'p2',
        displayName: PROFILES.p2.defaultName,
        avatarColor: PROFILES.p2.avatarColor,
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
  };
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
    // Clear any expired station locks on read
    const now = Date.now();
    for (const st of Object.values(parsed.stations)) {
      if (st.lockedBy && st.lockExpiresAt && new Date(st.lockExpiresAt).getTime() < now) {
        st.lockedBy = null;
        st.lockExpiresAt = null;
        if (st.status === 'in_use') st.status = 'idle';
      }
    }
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
  if (snapshot.coins >= 30) {
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
  rewardCoins: number,
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
  snapshot.coins += rewardCoins;
  snapshot.recipes[recipeId].inGameCookCount += 1;
  const st = snapshot.stations.stove;
  st.lockedBy = null;
  st.lockExpiresAt = null;
  st.status = 'ready';
  st.activeRecipeId = recipeId;
  st.stationPayload = { lastCooked: recipeId, by: profileId, at: new Date().toISOString() };
  writeLocalHome(snapshot);
  return { ok: true, snapshot };
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
