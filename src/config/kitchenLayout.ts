export type StationId = 'fridge' | 'cutting_board' | 'stove';

export interface Aabb2D {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface RoomBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface StationLayoutDef {
  id: StationId;
  label: string;
  subtitle: string;
  icon: string;
  /** Center position of the 3D station mesh (y = 0 at floor) */
  position: readonly [number, number, number];
  /** Target point on the floor where the chef stands to interact */
  interactionPoint: readonly [number, number];
  /** Facing Y rotation in radians (Three.js +Z forward = 0, -Z = Math.PI) */
  facingAngle: number;
  /** Clickable hitbox bounds (x, y, z dimensions) */
  hitboxSize: readonly [number, number, number];
  requiresLock: boolean;
}

/** Fixed 8m x 6m isometric kitchen (1 unit = 1 meter) */
export const KITCHEN_BOUNDS: RoomBounds = {
  minX: -4,
  maxX: 4,
  minZ: -3,
  maxZ: 3,
};

export const GRID_CELL_SIZE = 0.5; // 16 x 12 navigation grid
export const PLAYER_HALF_EXTENT = 0.28;
export const PLAYER_SPEED = 2.85; // meters per second

/**
 * Static 2D AABB obstacles in the XZ plane (no physics engine!).
 * Leaves wide >= 1.5m walkways so 2 players move comfortably.
 */
export const KITCHEN_OBSTACLES: readonly Aabb2D[] = [
  // Arka tezgah hattı (Buzdolabı + Kesme Tahtası + Ocak)
  {
    id: 'back_counter_line',
    minX: -4.0,
    maxX: 4.0,
    minZ: -3.0,
    maxZ: -1.9,
  },
  // Sol duvar yan tezgah + evye hattı
  {
    id: 'left_side_counter',
    minX: -4.0,
    maxX: -2.95,
    minZ: -1.9,
    maxZ: 1.15,
  },
  // Ortada kompakt servis adası (A* rota bulma test & mutfak estetiği)
  {
    id: 'center_island',
    minX: -0.85,
    maxX: 0.85,
    minZ: 0.5,
    maxZ: 1.45,
  },
];

export const KITCHEN_STATIONS: Record<StationId, StationLayoutDef> = {
  fridge: {
    id: 'fridge',
    label: 'Buzdolabı',
    subtitle: 'Ortak Ev Stoğu',
    icon: '🧊',
    position: [-3.25, 0, -2.4],
    interactionPoint: [-2.2, -1.45],
    facingAngle: -Math.PI * 0.72,
    hitboxSize: [1.15, 2.05, 1.0],
    requiresLock: false,
  },
  cutting_board: {
    id: 'cutting_board',
    label: 'Kesme Tahtası',
    subtitle: 'Malzeme Hazırlığı',
    icon: '🔪',
    position: [0.0, 0, -2.42],
    interactionPoint: [0.0, -1.45],
    facingAngle: Math.PI,
    hitboxSize: [1.35, 1.3, 1.0],
    requiresLock: true,
  },
  stove: {
    id: 'stove',
    label: 'Ocak',
    subtitle: 'Yemek Pişirme',
    icon: '🔥',
    position: [2.4, 0, -2.42],
    interactionPoint: [2.4, -1.45],
    facingAngle: Math.PI,
    hitboxSize: [1.35, 1.45, 1.0],
    requiresLock: true,
  },
};

export const STATION_LIST: readonly StationLayoutDef[] = [
  KITCHEN_STATIONS.fridge,
  KITCHEN_STATIONS.cutting_board,
  KITCHEN_STATIONS.stove,
];
