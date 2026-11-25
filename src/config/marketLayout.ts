import { KITCHEN_BOUNDS, type Aabb2D, type RoomDoorDef } from './kitchenLayout';
import type { ProfileId } from './profiles';

export type MarketStallId = 'produce' | 'dairy' | 'pantry';

export interface MarketStallDef {
  id: MarketStallId;
  label: string;
  subtitle: string;
  icon: string;
  position: readonly [number, number, number];
  interactionPoint: readonly [number, number];
  facingAngle: number;
  hitboxSize: readonly [number, number, number];
  itemIds: readonly string[];
}

export const MARKET_BOUNDS = KITCHEN_BOUNDS;

/** Static 2D AABB obstacles for the walkable 3D Neighborhood Market */
export const MARKET_OBSTACLES: readonly Aabb2D[] = [
  // Back wall stalls (Manav, Süt Dolabı, Kuru Gıda)
  {
    id: 'market_back_stalls',
    minX: -4.0,
    maxX: 4.0,
    minZ: -3.0,
    maxZ: -1.78,
  },
  // Left checkout & scales counter
  {
    id: 'market_checkout_counter',
    minX: -4.0,
    maxX: -2.95,
    minZ: -1.78,
    maxZ: 0.85,
  },
  // Center seasonal display table
  {
    id: 'market_center_display',
    minX: -0.9,
    maxX: 0.9,
    minZ: 0.55,
    maxZ: 1.4,
  },
];

export const MARKET_STALLS: Record<MarketStallId, MarketStallDef> = {
  produce: {
    id: 'produce',
    label: 'Manav Tezgahı',
    subtitle: 'Taze Sebze & Meyve',
    icon: '🍅',
    position: [-1.75, 0, -2.35],
    interactionPoint: [-1.75, -1.25],
    facingAngle: Math.PI,
    hitboxSize: [2.2, 2.05, 1.1],
    itemIds: ['domates', 'biber', 'mantar', 'cilek'],
  },
  dairy: {
    id: 'dairy',
    label: 'Süt & Yumurta',
    subtitle: 'Soğuk Kahvaltılık',
    icon: '🥛',
    position: [0.85, 0, -2.35],
    interactionPoint: [0.85, -1.25],
    facingAngle: Math.PI,
    hitboxSize: [1.65, 2.05, 1.05],
    itemIds: ['yumurta', 'sut', 'krema'],
  },
  pantry: {
    id: 'pantry',
    label: 'Kuru Gıda Rafı',
    subtitle: 'Makarna & Un',
    icon: '🍝',
    position: [2.98, 0, -2.35],
    interactionPoint: [2.98, -1.25],
    facingAngle: Math.PI,
    hitboxSize: [1.45, 2.0, 0.95],
    itemIds: ['makarna', 'un'],
  },
};

export const MARKET_STALL_LIST: readonly MarketStallDef[] = [
  MARKET_STALLS.produce,
  MARKET_STALLS.dairy,
  MARKET_STALLS.pantry,
];

export const MARKET_TO_KITCHEN_DOOR: RoomDoorDef = {
  targetRoom: 'kitchen',
  label: 'Mutfağa Dön',
  icon: '🏠',
  position: [-3.95, 0, 2.0],
  interactionPoint: [-3.15, 2.0],
  facingAngle: -Math.PI / 2,
};

export const MARKET_SPAWN: Record<ProfileId, readonly [number, number]> = {
  p1: [-2.2, 1.85],
  p2: [-1.4, 2.05],
};
