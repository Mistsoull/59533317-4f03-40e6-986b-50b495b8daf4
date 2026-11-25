import { describe, expect, it } from 'vitest';
import {
  KITCHEN_BOUNDS,
  KITCHEN_OBSTACLES,
  KITCHEN_STATIONS,
  PLAYER_HALF_EXTENT,
} from '../config/kitchenLayout';
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

    // X slides freely, Z stops flush at back_counter_line.maxZ + PLAYER_HALF_EXTENT
    expect(result.x).toBeCloseTo(1.0, 5);
    expect(result.z).toBeCloseTo(-1.9 + PLAYER_HALF_EXTENT, 5);
  });

  it('ensures every station interactionPoint is walkable', () => {
    for (const station of Object.values(KITCHEN_STATIONS)) {
      const [ix, iz] = station.interactionPoint;
      expect(
        isPointWalkable(ix, iz, PLAYER_HALF_EXTENT, KITCHEN_OBSTACLES, KITCHEN_BOUNDS),
      ).toBe(true);
    }
  });
});
