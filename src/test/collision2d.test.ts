import { describe, expect, it } from 'vitest';
import {
  KITCHEN_BOUNDS,
  KITCHEN_OBSTACLES,
  KITCHEN_STATIONS,
  KITCHEN_TO_MARKET_DOOR,
  PLAYER_HALF_EXTENT,
} from '../config/kitchenLayout';
import {
  MARKET_BOUNDS,
  MARKET_OBSTACLES,
  MARKET_STALLS,
  MARKET_TO_KITCHEN_DOOR,
} from '../config/marketLayout';
import { isPointWalkable, resolveMovement2D } from '../domain/collision2d';

describe('collision2d', () => {
  it('keeps players inside room boundaries', () => {
    const result = resolveMovement2D(
      { x: 3.5, z: 2.5 },
      { x: 10, z: 10 },
      PLAYER_HALF_EXTENT,
      KITCHEN_OBSTACLES,
      KITCHEN_BOUNDS,
    );

    expect(result.x).toBeCloseTo(KITCHEN_BOUNDS.maxX - PLAYER_HALF_EXTENT, 5);
    expect(result.z).toBeCloseTo(KITCHEN_BOUNDS.maxZ - PLAYER_HALF_EXTENT, 5);
  });

  it('prevents walking into the back counter while allowing lateral wall sliding', () => {
    const start = { x: 0, z: -1.5 };
    const result = resolveMovement2D(
      start,
      { x: 1.0, z: -2.5 },
      PLAYER_HALF_EXTENT,
      KITCHEN_OBSTACLES,
      KITCHEN_BOUNDS,
    );

    expect(result.x).toBeCloseTo(1.0, 5);
    expect(result.z).toBeCloseTo(-1.9 + PLAYER_HALF_EXTENT, 5);
  });

  it('ensures every kitchen station (including unobstructed fridge) and doorway is walkable', () => {
    for (const station of Object.values(KITCHEN_STATIONS)) {
      const [ix, iz] = station.interactionPoint;
      expect(
        isPointWalkable(ix, iz, PLAYER_HALF_EXTENT, KITCHEN_OBSTACLES, KITCHEN_BOUNDS),
      ).toBe(true);
    }

    const [dx, dz] = KITCHEN_TO_MARKET_DOOR.interactionPoint;
    expect(
      isPointWalkable(dx, dz, PLAYER_HALF_EXTENT, KITCHEN_OBSTACLES, KITCHEN_BOUNDS),
    ).toBe(true);
  });

  it('ensures every 3D Market stall and exit doorway is walkable', () => {
    for (const stall of Object.values(MARKET_STALLS)) {
      const [ix, iz] = stall.interactionPoint;
      expect(
        isPointWalkable(ix, iz, PLAYER_HALF_EXTENT, MARKET_OBSTACLES, MARKET_BOUNDS),
      ).toBe(true);
    }

    const [dx, dz] = MARKET_TO_KITCHEN_DOOR.interactionPoint;
    expect(
      isPointWalkable(dx, dz, PLAYER_HALF_EXTENT, MARKET_OBSTACLES, MARKET_BOUNDS),
    ).toBe(true);
  });
});
