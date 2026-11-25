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

/** Static 2D AABB obstacles for the walkable full-screen 3D Neighborhood Market */
export const MARKET_OBSTACLES: readonly Aabb2D[] = [
  // Back wall stalls (Manav, Süt & Yumurta, Kuru Gıda) — leaves back-left alcove open for exit door!
  {
    id: 'market_back_stalls',
    minX: -2.4,
    maxX: 4.0,
    minZ: -3.0,
    maxZ: -1.78,
  },
  // Left checkout & scales counter (cleanly forward of the back-left entrance door)
  {
    id: 'market_checkout_counter',
    minX: -4.0,
    maxX: -3.0,
    minZ: -0.6,
    maxZ: 1.75,
  },
  // Center seasonal display table
  {
    id: 'market_center_display',
    minX: -0.85,
    maxX: 0.85,
    minZ: 0.65,
    maxZ: 1.48,
  },
];

export const MARKET_STALLS: Record<MarketStallId, MarketStallDef> = {
  produce: {
    id: 'produce',
    label: 'Manav Tezgahı',
    subtitle: 'Taze Sebze & Meyve',
    icon: '🍅',
    position: [-1.25, 0, -2.35],
    interactionPoint: [-1.25, -1.25],
    facingAngle: Math.PI,
    hitboxSize: [2.15, 2.05, 1.1],
    itemIds: ['domates', 'biber', 'mantar', 'cilek'],
  },
  dairy: {
    id: 'dairy',
    label: 'Süt & Yumurta',
    subtitle: 'Soğuk Kahvaltılık',
    icon: '🥛',
    position: [1.02, 0, -2.35],
    interactionPoint: [1.02, -1.25],
    facingAngle: Math.PI,
    hitboxSize: [1.62, 2.05, 1.05],
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

/** Placed prominently on the back-left wall facing +Z so it is always visible on every screen ratio */
export const MARKET_TO_KITCHEN_DOOR: RoomDoorDef = {
  targetRoom: 'kitchen',
  label: 'Mutfağa Dön',
  icon: '🏠',
  position: [-3.28, 0, -3.02],
  interactionPoint: [-3.22, -2.0],
  facingAngle: Math.PI,
};

export const MARKET_SPAWN: Record<ProfileId, readonly [number, number]> = {
  p1: [-2.45, -0.85],
  p2: [-1.85, -0.5],
};
