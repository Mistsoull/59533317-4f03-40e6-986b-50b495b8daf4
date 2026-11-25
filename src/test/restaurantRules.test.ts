import { describe, expect, it } from 'vitest';
import {
  GRID_CELL_SIZE,
  KITCHEN_BOUNDS,
  KITCHEN_OBSTACLES,
  KITCHEN_SERVICE_PASS,
  KITCHEN_STATIONS,
  KITCHEN_TO_MARKET_DOOR,
  KITCHEN_TO_RESTAURANT_DOOR,
  PLAYER_HALF_EXTENT,
} from '../config/kitchenLayout';
import { PROFILES } from '../config/profiles';
import { RECIPES } from '../config/recipes';
import {
  RESTAURANT_BOUNDS,
  RESTAURANT_OBSTACLES,
  RESTAURANT_SERVICE_PASS,
  RESTAURANT_SPAWN,
  RESTAURANT_STREET_ENTRANCE,
  RESTAURANT_TABLE_LIST,
  RESTAURANT_TO_KITCHEN_DOOR,
} from '../config/restaurantLayout';
import { buildNavGrid, findPath2D } from '../domain/pathfinding';
import {
  calculateClockOffsetMs,
  calculateServePayout,
  computeDeliveryDurationSeconds,
  computeMaxActiveTables,
  electRestaurantHost,
  evaluateOrderPatience,
  findMatchingWaitingOrder,
  formatRemainingTime,
  pickNextSpawnCandidate,
  type RestaurantOrderView,
} from '../domain/restaurantRules';

describe('restaurantRules', () => {
  it('computes delivery duration by difficulty and applies 1.35x solo multiplier', () => {
    expect(computeDeliveryDurationSeconds(RECIPES.menemen, 2)).toBe(90);
    expect(computeDeliveryDurationSeconds(RECIPES.pankek, 2)).toBe(120);
    expect(computeDeliveryDurationSeconds(RECIPES.mantarli_makarna, 2)).toBe(150);

    expect(computeDeliveryDurationSeconds(RECIPES.menemen, 1)).toBe(122);
    expect(computeDeliveryDurationSeconds(RECIPES.pankek, 1)).toBe(162);
    expect(computeDeliveryDurationSeconds(RECIPES.mantarli_makarna, 1)).toBe(203);
  });

  it('evaluates patience tiers and Cozy Mode serve payouts accurately', () => {
    const base = 1_700_000_000_000;
    const created = new Date(base).toISOString();
    const expires = new Date(base + 100_000).toISOString();

    const happy = evaluateOrderPatience(created, expires, base + 20_000);
    expect(happy.level).toBe('happy');
    expect(happy.ratio).toBeCloseTo(0.8);
    expect(calculateServePayout(RECIPES.menemen, happy.ratio)).toEqual({
      rewardCoins: 65,
      tipCoins: 16,
      totalCoins: 81,
      patienceLevel: 'happy',
    });

    const impatient = evaluateOrderPatience(created, expires, base + 65_000);
    expect(impatient.level).toBe('impatient');
    expect(calculateServePayout(RECIPES.mantarli_makarna, impatient.ratio)).toEqual({
      rewardCoins: 120,
      tipCoins: 0,
      totalCoins: 120,
      patienceLevel: 'impatient',
    });

    const urgent = evaluateOrderPatience(created, expires, base + 90_000);
    expect(urgent.level).toBe('urgent');
    expect(calculateServePayout(RECIPES.pankek, urgent.ratio)).toEqual({
      rewardCoins: 81,
      tipCoins: 0,
      totalCoins: 81,
      patienceLevel: 'urgent',
    });

    const expired = evaluateOrderPatience(created, expires, base + 105_000);
    expect(expired.isExpired).toBe(true);
    expect(calculateServePayout(RECIPES.menemen, expired.ratio).totalCoins).toBe(0);
    expect(formatRemainingTime(65_100)).toBe('1:06');
  });

  it('elects deterministic Presence host with p1 priority and enforces table limits', () => {
    expect(electRestaurantHost(['p1', 'p2'], 'p1')).toBe(true);
    expect(electRestaurantHost(['p1', 'p2'], 'p2')).toBe(false);
    expect(electRestaurantHost(['p2'], 'p2')).toBe(true);
    expect(electRestaurantHost(['p1'], 'p1')).toBe(true);
    expect(electRestaurantHost([], null)).toBe(false);

    expect(computeMaxActiveTables(1)).toBe(2);
    expect(computeMaxActiveTables(2)).toBe(3);

    // Solo player capped at 2 active tables (including 'delivering')
    const twoActive = [
      {
        tableId: 'table_1' as const,
        status: 'waiting' as const,
        recipeId: 'menemen' as const,
        customerName: 'Tilki Mira',
        customerAvatar: 'cust_fox' as const,
      },
      {
        tableId: 'table_2' as const,
        status: 'delivering' as const,
        recipeId: 'pankek' as const,
        customerName: 'Tavşan Pamuk',
        customerAvatar: 'cust_bunny' as const,
      },
    ];
    expect(pickNextSpawnCandidate(twoActive, 1, 'tr', () => 0)).toBeNull();
    const thirdForDuo = pickNextSpawnCandidate(twoActive, 2, 'tr', () => 0);
    expect(thirdForDuo?.tableId).toBe('table_3');
    // Must pick a distinct recipe and non-duplicate customer/avatar!
    expect(thirdForDuo?.recipeId).toBe('mantarli_makarna');
    expect(thirdForDuo?.customerName).not.toBe('Tilki Mira');
    expect(thirdForDuo?.customerName).not.toBe('Tavşan Pamuk');
    expect(thirdForDuo?.customerAvatar).toBe('cust_bear');
  });

  it('computes clock skew offset and selects most urgent waiting order for a recipe', () => {
    // Server is 5 seconds ahead of client with 200ms RTT
    expect(calculateClockOffsetMs(10_500, 5_400, 5_600)).toBe(5000);

    const now = 1_700_000_000_000;
    const orders: RestaurantOrderView[] = [
      {
        id: 'later',
        tableId: 'table_1',
        recipeId: 'menemen',
        difficulty: 'easy',
        customerName: 'A',
        customerAvatar: 'cust_fox',
        status: 'waiting',
        createdAt: new Date(now - 10_000).toISOString(),
        expiresAt: new Date(now + 60_000).toISOString(),
        deliveredAt: null,
        servedBy: null,
        rewardCoins: 65,
        tipCoins: 0,
      },
      {
        id: 'urgent',
        tableId: 'table_2',
        recipeId: 'menemen',
        difficulty: 'easy',
        customerName: 'B',
        customerAvatar: 'cust_bunny',
        status: 'waiting',
        createdAt: new Date(now - 50_000).toISOString(),
        expiresAt: new Date(now + 20_000).toISOString(),
        deliveredAt: null,
        servedBy: null,
        rewardCoins: 65,
        tipCoins: 0,
      },
      {
        id: 'delivering_ignored',
        tableId: 'table_3',
        recipeId: 'menemen',
        difficulty: 'easy',
        customerName: 'C',
        customerAvatar: 'cust_bear',
        status: 'delivering',
        createdAt: new Date(now - 80_000).toISOString(),
        expiresAt: new Date(now + 5_000).toISOString(),
        deliveredAt: new Date(now - 1_000).toISOString(),
        servedBy: 'p1',
        rewardCoins: 65,
        tipCoins: 16,
      },
    ];

    expect(findMatchingWaitingOrder(orders, 'menemen', now)?.id).toBe('urgent');
    expect(findMatchingWaitingOrder(orders, 'pankek', now)).toBeNull();
  });

  it('keeps Kitchen and Restaurant AABB obstacles free of collisions with all doors, stations, waiter, and seats', () => {
    const kitchenGrid = buildNavGrid(
      KITCHEN_BOUNDS,
      GRID_CELL_SIZE,
      PLAYER_HALF_EXTENT,
      KITCHEN_OBSTACLES,
    );
    const kitchenStart = {
      x: PROFILES.p1.spawnPosition[0],
      z: PROFILES.p1.spawnPosition[1],
    };

    const kitchenTargets = [
      KITCHEN_STATIONS.cutting_board.interactionPoint,
      KITCHEN_STATIONS.stove.interactionPoint,
      KITCHEN_STATIONS.fridge.interactionPoint,
      KITCHEN_TO_MARKET_DOOR.interactionPoint,
      KITCHEN_SERVICE_PASS.interactionPoint,
      KITCHEN_TO_RESTAURANT_DOOR.interactionPoint,
    ];

    for (const [tx, tz] of kitchenTargets) {
      const path = findPath2D(
        kitchenGrid,
        kitchenStart,
        { x: tx, z: tz },
        PLAYER_HALF_EXTENT,
        KITCHEN_OBSTACLES,
      );
      expect(path.length).toBeGreaterThan(0);
      const last = path[path.length - 1];
      expect(Math.hypot(last.x - tx, last.z - tz)).toBeLessThan(0.55);
    }

    const restaurantGrid = buildNavGrid(
      RESTAURANT_BOUNDS,
      GRID_CELL_SIZE,
      PLAYER_HALF_EXTENT,
      RESTAURANT_OBSTACLES,
    );
    const waiterStart = {
      x: RESTAURANT_SERVICE_PASS.waiterIdlePoint[0],
      z: RESTAURANT_SERVICE_PASS.waiterIdlePoint[1],
    };
    const streetStart = {
      x: RESTAURANT_STREET_ENTRANCE.spawnPoint[0],
      z: RESTAURANT_STREET_ENTRANCE.spawnPoint[1],
    };

    for (const table of RESTAURANT_TABLE_LIST) {
      // Waiter can walk from Service Pass to each table's drop-off point
      const waiterPath = findPath2D(
        restaurantGrid,
        waiterStart,
        { x: table.waiterPoint[0], z: table.waiterPoint[1] },
        PLAYER_HALF_EXTENT,
        RESTAURANT_OBSTACLES,
      );
      expect(waiterPath.length).toBeGreaterThan(0);
      const waiterEnd = waiterPath[waiterPath.length - 1];
      expect(
        Math.hypot(waiterEnd.x - table.waiterPoint[0], waiterEnd.z - table.waiterPoint[1]),
      ).toBeLessThan(0.55);

      // Customer can walk from street entrance to each table's chair
      const custPath = findPath2D(
        restaurantGrid,
        streetStart,
        { x: table.seatPoint[0], z: table.seatPoint[1] },
        PLAYER_HALF_EXTENT,
        RESTAURANT_OBSTACLES,
      );
      expect(custPath.length).toBeGreaterThan(0);
      const custEnd = custPath[custPath.length - 1];
      expect(
        Math.hypot(custEnd.x - table.seatPoint[0], custEnd.z - table.seatPoint[1]),
      ).toBeLessThan(0.55);
    }

    // Player spawn can reach kitchen door and pass counter
    const playerStart = { x: RESTAURANT_SPAWN.p1[0], z: RESTAURANT_SPAWN.p1[1] };
    for (const [tx, tz] of [
      RESTAURANT_TO_KITCHEN_DOOR.interactionPoint,
      RESTAURANT_SERVICE_PASS.interactionPoint,
    ]) {
      const path = findPath2D(
        restaurantGrid,
        playerStart,
        { x: tx, z: tz },
        PLAYER_HALF_EXTENT,
        RESTAURANT_OBSTACLES,
      );
      expect(path.length).toBeGreaterThan(0);
    }
  });
});
