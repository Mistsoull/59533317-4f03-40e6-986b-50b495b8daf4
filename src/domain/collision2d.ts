import type { Aabb2D, RoomBounds } from '../config/kitchenLayout';

export interface Vec2 {
  x: number;
  z: number;
}

export function pointIntersectsAabb(
  x: number,
  z: number,
  box: Aabb2D,
  padding = 0,
): boolean {
  return (
    x > box.minX - padding &&
    x < box.maxX + padding &&
    z > box.minZ - padding &&
    z < box.maxZ + padding
  );
}

export function isPointWalkable(
  x: number,
  z: number,
  halfExtent: number,
  obstacles: readonly Aabb2D[],
  bounds: RoomBounds,
): boolean {
  if (
    x < bounds.minX + halfExtent ||
    x > bounds.maxX - halfExtent ||
    z < bounds.minZ + halfExtent ||
    z > bounds.maxZ - halfExtent
  ) {
    return false;
  }

  for (let i = 0; i < obstacles.length; i += 1) {
    if (pointIntersectsAabb(x, z, obstacles[i], halfExtent)) {
      return false;
    }
  }
  return true;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Axis-separated lightweight 2D AABB movement resolver with smooth wall sliding.
 */
export function resolveMovement2D(
  current: Vec2,
  desired: Vec2,
  halfExtent: number,
  obstacles: readonly Aabb2D[],
  bounds: RoomBounds,
): Vec2 {
  const minX = bounds.minX + halfExtent;
  const maxX = bounds.maxX - halfExtent;
  const minZ = bounds.minZ + halfExtent;
  const maxZ = bounds.maxZ - halfExtent;

  // Step 1: resolve X axis
  let nextX = clamp(desired.x, minX, maxX);
  const startZ = clamp(current.z, minZ, maxZ);
  for (let i = 0; i < obstacles.length; i += 1) {
    const box = obstacles[i];
    if (pointIntersectsAabb(nextX, startZ, box, halfExtent)) {
      if (desired.x > current.x) {
        nextX = Math.min(nextX, box.minX - halfExtent);
      } else if (desired.x < current.x) {
        nextX = Math.max(nextX, box.maxX + halfExtent);
      } else {
        nextX = current.x;
      }
    }
  }

  // Step 2: resolve Z axis against updated X
  let nextZ = clamp(desired.z, minZ, maxZ);
  for (let i = 0; i < obstacles.length; i += 1) {
    const box = obstacles[i];
    if (pointIntersectsAabb(nextX, nextZ, box, halfExtent)) {
      if (desired.z > current.z) {
        nextZ = Math.min(nextZ, box.minZ - halfExtent);
      } else if (desired.z < current.z) {
        nextZ = Math.max(nextZ, box.maxZ + halfExtent);
      } else {
        nextZ = startZ;
      }
    }
  }

  return {
    x: clamp(nextX, minX, maxX),
    z: clamp(nextZ, minZ, maxZ),
  };
}

/**
 * Checks if the straight segment from a to b stays strictly walkable
 * using dense sampling (used for A* string-pulling smoothing).
 */
export function hasLineOfSight(
  a: Vec2,
  b: Vec2,
  halfExtent: number,
  obstacles: readonly Aabb2D[],
  bounds: RoomBounds,
  step = 0.12,
): boolean {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const dist = Math.hypot(dx, dz);
  const samples = Math.max(2, Math.ceil(dist / step));

  for (let i = 1; i <= samples; i += 1) {
    const t = i / samples;
    const px = a.x + dx * t;
    const pz = a.z + dz * t;
    if (!isPointWalkable(px, pz, halfExtent, obstacles, bounds)) {
      return false;
    }
  }
  return true;
}
