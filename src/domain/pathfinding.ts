import type { Aabb2D, RoomBounds } from '../config/kitchenLayout';
import { hasLineOfSight, isPointWalkable, type Vec2 } from './collision2d';

export interface NavGrid {
  cols: number;
  rows: number;
  cellSize: number;
  bounds: RoomBounds;
  walkable: Uint8Array;
}

export function buildNavGrid(
  bounds: RoomBounds,
  cellSize: number,
  halfExtent: number,
  obstacles: readonly Aabb2D[],
): NavGrid {
  const cols = Math.round((bounds.maxX - bounds.minX) / cellSize);
  const rows = Math.round((bounds.maxZ - bounds.minZ) / cellSize);
  const walkable = new Uint8Array(cols * rows);

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const worldX = bounds.minX + (c + 0.5) * cellSize;
      const worldZ = bounds.minZ + (r + 0.5) * cellSize;
      walkable[r * cols + c] = isPointWalkable(worldX, worldZ, halfExtent, obstacles, bounds)
        ? 1
        : 0;
    }
  }

  return { cols, rows, cellSize, bounds, walkable };
}

function worldToCell(grid: NavGrid, p: Vec2): { c: number; r: number } {
  const c = Math.max(
    0,
    Math.min(grid.cols - 1, Math.floor((p.x - grid.bounds.minX) / grid.cellSize)),
  );
  const r = Math.max(
    0,
    Math.min(grid.rows - 1, Math.floor((p.z - grid.bounds.minZ) / grid.cellSize)),
  );
  return { c, r };
}

function cellToWorld(grid: NavGrid, c: number, r: number): Vec2 {
  return {
    x: grid.bounds.minX + (c + 0.5) * grid.cellSize,
    z: grid.bounds.minZ + (r + 0.5) * grid.cellSize,
  };
}

function findNearestWalkableCell(
  grid: NavGrid,
  originC: number,
  originR: number,
): { c: number; r: number } | null {
  if (grid.walkable[originR * grid.cols + originC] === 1) {
    return { c: originC, r: originR };
  }

  let best: { c: number; r: number } | null = null;
  let bestDistSq = Infinity;

  for (let r = 0; r < grid.rows; r += 1) {
    for (let c = 0; c < grid.cols; c += 1) {
      if (grid.walkable[r * grid.cols + c] !== 1) continue;
      const dSq = (c - originC) ** 2 + (r - originR) ** 2;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        best = { c, r };
      }
    }
  }

  return best;
}

const NEIGHBORS: readonly [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

/**
 * Pure TypeScript 2D Grid A* with anti-corner-cutting and line-of-sight smoothing.
 */
export function findPath2D(
  grid: NavGrid,
  start: Vec2,
  goal: Vec2,
  halfExtent: number,
  obstacles: readonly Aabb2D[],
): Vec2[] {
  const exactGoalWalkable = isPointWalkable(
    goal.x,
    goal.z,
    halfExtent,
    obstacles,
    grid.bounds,
  );

  // Fast path: straight unobstructed line directly to goal
  if (
    exactGoalWalkable &&
    hasLineOfSight(start, goal, halfExtent, obstacles, grid.bounds)
  ) {
    return [goal];
  }

  const rawStartCell = worldToCell(grid, start);
  const rawGoalCell = worldToCell(grid, goal);

  const startCell = findNearestWalkableCell(grid, rawStartCell.c, rawStartCell.r);
  const goalCell = findNearestWalkableCell(grid, rawGoalCell.c, rawGoalCell.r);
  if (!startCell || !goalCell) {
    return [];
  }

  const startIdx = startCell.r * grid.cols + startCell.c;
  const goalIdx = goalCell.r * grid.cols + goalCell.c;
  if (startIdx === goalIdx) {
    return [exactGoalWalkable ? goal : cellToWorld(grid, goalCell.c, goalCell.r)];
  }

  const total = grid.cols * grid.rows;
  const gScore = new Float64Array(total).fill(Infinity);
  const fScore = new Float64Array(total).fill(Infinity);
  const cameFrom = new Int32Array(total).fill(-1);
  const inOpen = new Uint8Array(total);
  const closed = new Uint8Array(total);

  gScore[startIdx] = 0;
  fScore[startIdx] = Math.hypot(goalCell.c - startCell.c, goalCell.r - startCell.r);
  const openList: number[] = [startIdx];
  inOpen[startIdx] = 1;

  let reached = false;

  while (openList.length > 0) {
    // Small grid (192 cells): linear scan for min fScore is ultra-fast & allocation-free
    let bestPos = 0;
    let current = openList[0];
    let bestF = fScore[current];
    for (let i = 1; i < openList.length; i += 1) {
      const idx = openList[i];
      if (fScore[idx] < bestF) {
        bestF = fScore[idx];
        current = idx;
        bestPos = i;
      }
    }

    if (current === goalIdx) {
      reached = true;
      break;
    }

    openList.splice(bestPos, 1);
    inOpen[current] = 0;
    closed[current] = 1;

    const cc = current % grid.cols;
    const cr = Math.floor(current / grid.cols);

    for (let n = 0; n < NEIGHBORS.length; n += 1) {
      const [dc, dr, cost] = NEIGHBORS[n];
      const nc = cc + dc;
      const nr = cr + dr;
      if (nc < 0 || nc >= grid.cols || nr < 0 || nr >= grid.rows) continue;

      const nIdx = nr * grid.cols + nc;
      if (closed[nIdx] === 1 || grid.walkable[nIdx] !== 1) continue;

      // Prevent diagonal corner cutting through blocked orthogonal neighbors
      if (dc !== 0 && dr !== 0) {
        if (
          grid.walkable[cr * grid.cols + nc] !== 1 ||
          grid.walkable[nr * grid.cols + cc] !== 1
        ) {
          continue;
        }
      }

      const tentativeG = gScore[current] + cost;
      if (tentativeG < gScore[nIdx]) {
        cameFrom[nIdx] = current;
        gScore[nIdx] = tentativeG;
        fScore[nIdx] = tentativeG + Math.hypot(goalCell.c - nc, goalCell.r - nr);
        if (inOpen[nIdx] === 0) {
          openList.push(nIdx);
          inOpen[nIdx] = 1;
        }
      }
    }
  }

  if (!reached) {
    return [];
  }

  // Reconstruct path
  const rawPoints: Vec2[] = [];
  let cursor = goalIdx;
  while (cursor !== -1 && cursor !== startIdx) {
    const c = cursor % grid.cols;
    const r = Math.floor(cursor / grid.cols);
    rawPoints.push(cellToWorld(grid, c, r));
    cursor = cameFrom[cursor];
  }
  rawPoints.reverse();

  if (exactGoalWalkable && rawPoints.length > 0) {
    rawPoints[rawPoints.length - 1] = goal;
  }

  return smoothPath(start, rawPoints, halfExtent, obstacles, grid.bounds);
}

function smoothPath(
  start: Vec2,
  waypoints: Vec2[],
  halfExtent: number,
  obstacles: readonly Aabb2D[],
  bounds: RoomBounds,
): Vec2[] {
  if (waypoints.length <= 1) return waypoints;

  const smoothed: Vec2[] = [];
  let anchor = start;
  let index = 0;

  while (index < waypoints.length) {
    let farthest = index;
    for (let probe = waypoints.length - 1; probe > index; probe -= 1) {
      if (hasLineOfSight(anchor, waypoints[probe], halfExtent, obstacles, bounds)) {
        farthest = probe;
        break;
      }
    }
    smoothed.push(waypoints[farthest]);
    anchor = waypoints[farthest];
    index = farthest + 1;
  }

  return smoothed;
}
