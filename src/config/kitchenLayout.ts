export type RoomId = 'kitchen' | 'market' | 'restaurant';
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

export interface RoomDoorDef {
  targetRoom: RoomId;
  label: string;
  icon: string;
  position: readonly [number, number, number];
  interactionPoint: readonly [number, number];
  facingAngle: number;
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
export const PLAYER_SPEED = 2.95; // meters per second

/**
 * Static 2D AABB obstacles in the XZ plane (no physics engine!).
 * Left counter joins the back wall cleanly; Fridge stands unobstructed at the far-right back wall!
 */
export const KITCHEN_OBSTACLES: readonly Aabb2D[] = [
  // Arka tezgah + Kesme Tahtası + Ocak + Buzdolabı (sağ uçta tamamen engelsiz)
  {
    id: 'back_counter_line',
    minX: -4.0,
    maxX: 4.0,
    minZ: -3.0,
    maxZ: -1.9,
  },
  // Sol duvar evye tezgahı (kapıya geniş geçiş bırakır)
  {
    id: 'left_side_counter',
    minX: -4.0,
    maxX: -2.95,
    minZ: -1.9,
    maxZ: 0.95,
  },
  // Ortada kompakt kahvaltı adası
  {
    id: 'center_island',
    minX: -0.8,
    maxX: 0.8,
    minZ: 0.55,
    maxZ: 1.45,
  },
  // Sağ kenar Servis Bankosu / Zili (Buzdolabı z=-2.42 & Restoran Kapısı z=2.05'ten tamamen ayrı!)
  {
    id: 'kitchen_service_pass',
    minX: 3.35,
    maxX: 4.0,
    minZ: -0.2,
    maxZ: 0.95,
  },
];

export const KITCHEN_STATIONS: Record<StationId, StationLayoutDef> = {
  cutting_board: {
    id: 'cutting_board',
    label: 'Kesme Tahtası',
    subtitle: 'Malzeme Hazırlığı',
    icon: '🔪',
    position: [-1.15, 0, -2.42],
    interactionPoint: [-1.15, -1.42],
    facingAngle: Math.PI,
    hitboxSize: [1.35, 1.3, 1.0],
    requiresLock: true,
  },
  stove: {
    id: 'stove',
    label: 'Ocak',
    subtitle: 'Yemek Pişirme',
    icon: '🔥',
    position: [1.05, 0, -2.42],
    interactionPoint: [1.05, -1.42],
    facingAngle: Math.PI,
    hitboxSize: [1.35, 1.45, 1.0],
    requiresLock: true,
  },
  fridge: {
    id: 'fridge',
    label: 'Buzdolabı',
    subtitle: 'Ortak Ev Stoğu',
    icon: '🧊',
    // Unobstructed right-end placement so double doors open freely into +Z floor!
    position: [3.22, 0, -2.42],
    interactionPoint: [3.12, -1.38],
    facingAngle: Math.PI,
    hitboxSize: [1.15, 2.05, 1.0],
    requiresLock: false,
  },
};

export const KITCHEN_TO_MARKET_DOOR: RoomDoorDef = {
  targetRoom: 'market',
  label: 'Markete Git',
  icon: '🛒',
  position: [-3.95, 0, 2.0],
  interactionPoint: [-3.15, 2.0],
  facingAngle: -Math.PI / 2,
};

export const KITCHEN_TO_RESTAURANT_DOOR: RoomDoorDef = {
  targetRoom: 'restaurant',
  label: 'Restorana Git',
  icon: '🍽️',
  position: [3.95, 0, 2.05],
  interactionPoint: [3.15, 2.05],
  facingAngle: Math.PI / 2,
};

export interface ServicePassDef {
  position: readonly [number, number, number];
  interactionPoint: readonly [number, number];
  facingAngle: number;
  hitboxSize: readonly [number, number, number];
}

/**
 * Kitchen-side Service Pass Counter & Bell (clear of Fridge at z=-2.42 and Restaurant Door at z=2.05).
 */
export const KITCHEN_SERVICE_PASS: ServicePassDef = {
  position: [3.68, 0, 0.38],
  interactionPoint: [2.75, 0.38],
  facingAngle: Math.PI / 2,
  hitboxSize: [0.85, 1.3, 1.25],
};

export const STATION_LIST: readonly StationLayoutDef[] = [
  KITCHEN_STATIONS.cutting_board,
  KITCHEN_STATIONS.stove,
  KITCHEN_STATIONS.fridge,
];
