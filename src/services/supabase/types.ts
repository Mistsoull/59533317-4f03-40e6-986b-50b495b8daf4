import type { CharacterId } from '../../config/characters';
import type { ProfileId } from '../../config/profiles';
import type { RecipeId } from '../../config/recipes';
import type { RoomId, StationId } from '../../config/kitchenLayout';

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

export interface HomeSnapshot {
  coins: number;
  profiles: Record<ProfileId, ProfileRow>;
  inventory: Record<string, number>;
  stations: Record<StationId, StationStateRow>;
  recipes: Record<RecipeId, RecipeProgressRow>;
}

export interface BroadcastPlayerPayload {
  profileId: ProfileId;
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
}
