import type { CharacterId } from '../../config/characters';
import type { ProfileId } from '../../config/profiles';
import type { RecipeDifficulty, RecipeId } from '../../config/recipes';
import type { RoomId, StationId } from '../../config/kitchenLayout';
import type { CustomerAvatarId, TableId } from '../../config/restaurantLayout';
import type { OrderStatus } from '../../domain/restaurantRules';

export type AnimState = 'Idle' | 'Walk' | 'Interact';

export interface ProfileRow {
  id: ProfileId;
  displayName: string;
  avatarColor: string;
  characterId: CharacterId;
}

export interface StationStateRow {
  id: StationId;
  status: 'idle' | 'in_use' | 'ready';
  activeRecipeId: RecipeId | null;
  stationPayload: Record<string, unknown>;
  lockedBy: ProfileId | null;
  lockExpiresAt: string | null;
}

export interface RecipeProgressRow {
  recipeId: RecipeId;
  inGameCookCount: number;
  irlCookedCount: number;
  irlConfirmedP1: boolean;
  irlConfirmedP2: boolean;
  irlLastCookedAt: string | null;
  irlNote: string | null;
}

export interface RestaurantOrderRow {
  id: string;
  tableId: TableId;
  recipeId: RecipeId;
  difficulty: RecipeDifficulty;
  customerName: string;
  customerAvatar: CustomerAvatarId;
  status: OrderStatus;
  createdAt: string;
  expiresAt: string;
  deliveredAt: string | null;
  servedBy: ProfileId | null;
  rewardCoins: number;
  tipCoins: number;
}

export interface HomeSnapshot {
  coins: number;
  restaurantOpen: boolean;
  servedOrdersCount: number;
  serviceStreak: number;
  lastOrderSpawnedAt: string | null;
  profiles: Record<ProfileId, ProfileRow>;
  inventory: Record<string, number>;
  stations: Record<StationId, StationStateRow>;
  recipes: Record<RecipeId, RecipeProgressRow>;
  orders: RestaurantOrderRow[];
}

export interface BroadcastPlayerPayload {
  profileId: ProfileId;
  sessionNonce: string;
  room: RoomId;
  x: number;
  z: number;
  rotY: number;
  anim: AnimState;
  seq: number;
  ts: number;
}

export interface PresencePayload {
  profileId: ProfileId;
  displayName: string;
  characterId: CharacterId;
  room: RoomId;
  onlineAt: string;
  activeStationId: StationId | null;
  /** Ephemeral initial snapshot so late joiners immediately see stationary partners (never stored in DB) */
  x?: number;
  z?: number;
  rotY?: number;
  anim?: AnimState;
}
