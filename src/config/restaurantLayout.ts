import type { ProfileId } from './profiles';
import { KITCHEN_BOUNDS, type Aabb2D, type RoomBounds, type RoomDoorDef } from './kitchenLayout';

export type TableId = 'table_1' | 'table_2' | 'table_3';
export type CustomerAvatarId = 'cust_fox' | 'cust_bunny' | 'cust_bear';

export interface RestaurantTableDef {
  id: TableId;
  tableNumber: number;
  /** Center position of the 3D table+chair mesh (y = 0 at floor) */
  position: readonly [number, number, number];
  /** Chair/seat point where the customer NPC walks to and sits */
  seatPoint: readonly [number, number];
  /** Facing angle of the seated customer (toward table) */
  seatFacing: number;
  /** Point where the Waiter NPC walks to drop off the cooked dish */
  waiterPoint: readonly [number, number];
  /** Facing angle of the Waiter NPC when dropping off the dish */
  waiterFacing: number;
  /** Tabletop center world offset for placing the 3D cooked dish */
  dishPosition: readonly [number, number, number];
}

export interface CustomerPreset {
  avatar: CustomerAvatarId;
  nameTr: string;
  nameDe: string;
  accentColor: string;
}

export const CUSTOMER_PRESETS: readonly CustomerPreset[] = [
  { avatar: 'cust_fox', nameTr: 'Tilki Tarçın', nameDe: 'Fuchs Zimt', accentColor: '#e76f51' },
  { avatar: 'cust_bunny', nameTr: 'Tavşan Pamuk', nameDe: 'Hase Wolke', accentColor: '#e5989b' },
  { avatar: 'cust_bear', nameTr: 'Ayıcık Bal', nameDe: 'Bär Honig', accentColor: '#bc6c25' },
  { avatar: 'cust_fox', nameTr: 'Tilki Mira', nameDe: 'Fuchs Mira', accentColor: '#f4a261' },
  { avatar: 'cust_bunny', nameTr: 'Tavşan Mochi', nameDe: 'Hase Mochi', accentColor: '#cdb4db' },
  { avatar: 'cust_bear', nameTr: 'Ayıcık Fındık', nameDe: 'Bär Nuss', accentColor: '#8d5524' },
];

/** Fixed 8m x 6m cozy dining room (same 1 unit = 1m grid as Kitchen) */
export const RESTAURANT_BOUNDS: RoomBounds = KITCHEN_BOUNDS;

/**
 * Static 2D AABB obstacles in the Restaurant dining room.
 * Generous corridors guarantee 2D A* routing for players, customers, and the Waiter NPC.
 */
export const RESTAURANT_OBSTACLES: readonly Aabb2D[] = [
  // Back-left Service Pass Counter where the Waiter picks up cooked dishes
  {
    id: 'restaurant_pass_counter',
    minX: -4.0,
    maxX: -2.85,
    minZ: -3.0,
    maxZ: -1.75,
  },
  // Table 1 (left-center)
  {
    id: 'table_1',
    minX: -2.6,
    maxX: -1.7,
    minZ: -0.8,
    maxZ: 0.1,
  },
  // Table 2 (right-center)
  {
    id: 'table_2',
    minX: 0.7,
    maxX: 1.6,
    minZ: -0.8,
    maxZ: 0.1,
  },
  // Table 3 (front-center)
  {
    id: 'table_3',
    minX: -0.1,
    maxX: 0.8,
    minZ: 1.3,
    maxZ: 2.2,
  },
];

export const RESTAURANT_TABLES: Record<TableId, RestaurantTableDef> = {
  table_1: {
    id: 'table_1',
    tableNumber: 1,
    position: [-2.15, 0, -0.35],
    seatPoint: [-2.15, -1.35],
    seatFacing: 0,
    waiterPoint: [-1.15, -0.35],
    waiterFacing: -Math.PI / 2,
    dishPosition: [-2.15, 0.78, -0.35],
  },
  table_2: {
    id: 'table_2',
    tableNumber: 2,
    position: [1.15, 0, -0.35],
    seatPoint: [1.15, -1.35],
    seatFacing: 0,
    waiterPoint: [0.15, -0.35],
    waiterFacing: Math.PI / 2,
    dishPosition: [1.15, 0.78, -0.35],
  },
  table_3: {
    id: 'table_3',
    tableNumber: 3,
    position: [0.35, 0, 1.75],
    seatPoint: [1.35, 1.75],
    seatFacing: -Math.PI / 2,
    waiterPoint: [-0.65, 1.75],
    waiterFacing: Math.PI / 2,
    dishPosition: [0.35, 0.78, 1.75],
  },
};

export const RESTAURANT_TABLE_LIST: readonly RestaurantTableDef[] = [
  RESTAURANT_TABLES.table_1,
  RESTAURANT_TABLES.table_2,
  RESTAURANT_TABLES.table_3,
];

/** Street entrance on back-right wall where customers walk in and exit */
export const RESTAURANT_STREET_ENTRANCE = {
  doorPosition: [2.65, 0, -2.98] as readonly [number, number, number],
  spawnPoint: [2.65, -2.5] as readonly [number, number],
  exitPoint: [2.65, -2.5] as readonly [number, number],
};

/** Restaurant-side Service Pass Counter & Waiter home station */
export const RESTAURANT_SERVICE_PASS = {
  position: [-3.42, 0, -2.35] as readonly [number, number, number],
  interactionPoint: [-2.25, -2.35] as readonly [number, number],
  waiterIdlePoint: [-2.25, -2.35] as readonly [number, number],
  facingAngle: -Math.PI / 2,
  waiterIdleFacing: Math.PI / 2,
  hitboxSize: [1.15, 1.35, 1.25] as readonly [number, number, number],
};

/** Walkable doorway returning to Kitchen */
export const RESTAURANT_TO_KITCHEN_DOOR: RoomDoorDef = {
  targetRoom: 'kitchen',
  label: 'Mutfağa Dön',
  icon: '🍳',
  position: [-3.95, 0, 1.95],
  interactionPoint: [-3.15, 1.95],
  facingAngle: -Math.PI / 2,
};

export const RESTAURANT_SPAWN: Record<ProfileId, readonly [number, number]> = {
  p1: [-2.45, 1.75],
  p2: [-2.45, 2.3],
};
