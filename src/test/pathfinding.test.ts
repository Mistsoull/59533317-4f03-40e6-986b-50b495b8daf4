import { describe, expect, it } from 'vitest';
import {
  GRID_CELL_SIZE,
  KITCHEN_BOUNDS,
  KITCHEN_OBSTACLES,
  KITCHEN_STATIONS,
  PLAYER_HALF_EXTENT,
} from '../config/kitchenLayout';
import { isPointWalkable } from '../domain/collision2d';
import { buildNavGrid, findPath2D } from '../domain/pathfinding';

describe('pathfinding (2D grid A*)', () => {
  const grid = buildNavGrid(
    KITCHEN_BOUNDS,
    GRID_CELL_SIZE,
    PLAYER_HALF_EXTENT,
    KITCHEN_OBSTACLES,
  );

  it('routes around the center kitchen island without intersecting it', () => {
    const start = { x: 0, z: -0.5 };
    const goal = { x: 0, z: 2.3 };
    const path = findPath2D(grid, start, goal, PLAYER_HALF_EXTENT, KITCHEN_OBSTACLES);

    expect(path.length).toBeGreaterThan(1);
    const last = path[path.length - 1];
    expect(last.x).toBeCloseTo(goal.x, 2);
    expect(last.z).toBeCloseTo(goal.z, 2);

    for (const pt of path) {
      expect(
        isPointWalkable(pt.x, pt.z, PLAYER_HALF_EXTENT, KITCHEN_OBSTACLES, KITCHEN_BOUNDS),
      ).toBe(true);
    }
  });

  it('finds a valid path to every station interactionPoint from across the room', () => {
    const start = { x: 2.8, z: 2.2 };
    for (const station of Object.values(KITCHEN_STATIONS)) {
      const [gx, gz] = station.interactionPoint;
      const path = findPath2D(
        grid,
        start,
        { x: gx, z: gz },
        PLAYER_HALF_EXTENT,
        KITCHEN_OBSTACLES,
      );
      expect(path.length).toBeGreaterThan(0);
      const end = path[path.length - 1];
      expect(Math.hypot(end.x - gx, end.z - gz)).toBeLessThan(0.05);
    }
  });

  it('snaps gracefully to the nearest walkable tile when tapping inside an obstacle', () => {
    const start = { x: 0, z: -0.5 };
    const insideIsland = { x: 0, z: 0.95 };
    const path = findPath2D(
      grid,
      start,
      insideIsland,
      PLAYER_HALF_EXTENT,
      KITCHEN_OBSTACLES,
    );

    expect(path.length).toBeGreaterThan(0);
    const end = path[path.length - 1];
    expect(
      isPointWalkable(end.x, end.z, PLAYER_HALF_EXTENT, KITCHEN_OBSTACLES, KITCHEN_BOUNDS),
    ).toBe(true);
  });
});
