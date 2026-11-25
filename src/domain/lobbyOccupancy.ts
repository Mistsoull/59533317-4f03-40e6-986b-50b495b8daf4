import { CHARACTER_LIST, type CharacterId } from '../config/characters';
import { PROFILE_LIST, type ProfileId } from '../config/profiles';

export interface OccupiedEntry {
  profileId: ProfileId;
  displayName: string;
  characterId: CharacterId;
}

export interface LobbyOccupancy {
  profiles: Partial<Record<ProfileId, OccupiedEntry>>;
  characters: Partial<Record<CharacterId, OccupiedEntry>>;
}

export const EMPTY_LOBBY_OCCUPANCY: LobbyOccupancy = {
  profiles: {},
  characters: {},
};

export function isValidProfileId(value: unknown): value is ProfileId {
  return value === 'p1' || value === 'p2';
}

export function isValidCharacterId(value: unknown): value is CharacterId {
  return value === 'bubu' || value === 'dudu' || value === 'cat' || value === 'dog';
}

export function buildLobbyOccupancy(entries: Iterable<OccupiedEntry>): LobbyOccupancy {
  const profiles: Partial<Record<ProfileId, OccupiedEntry>> = {};
  const characters: Partial<Record<CharacterId, OccupiedEntry>> = {};

  for (const entry of entries) {
    if (!isValidProfileId(entry.profileId)) continue;
    profiles[entry.profileId] = entry;
    if (isValidCharacterId(entry.characterId)) {
      characters[entry.characterId] = entry;
    }
  }

  return { profiles, characters };
}

export function isProfileOccupied(
  occupancy: LobbyOccupancy,
  profileId: ProfileId,
): boolean {
  return Boolean(occupancy.profiles[profileId]);
}

export function isCharacterOccupied(
  occupancy: LobbyOccupancy,
  characterId: CharacterId,
): boolean {
  return Boolean(occupancy.characters[characterId]);
}

export function areAllProfilesOccupied(occupancy: LobbyOccupancy): boolean {
  return PROFILE_LIST.every((profile) => isProfileOccupied(occupancy, profile.id));
}

export function pickAvailableProfile(
  preferred: ProfileId,
  occupancy: LobbyOccupancy,
): ProfileId | null {
  if (!isProfileOccupied(occupancy, preferred)) {
    return preferred;
  }
  const free = PROFILE_LIST.find((profile) => !isProfileOccupied(occupancy, profile.id));
  return free ? free.id : null;
}

export function pickAvailableCharacter(
  preferred: CharacterId,
  occupancy: LobbyOccupancy,
): CharacterId | null {
  if (!isCharacterOccupied(occupancy, preferred)) {
    return preferred;
  }
  const free = CHARACTER_LIST.find((ch) => !isCharacterOccupied(occupancy, ch.id));
  return free ? free.id : null;
}

export function canEnterGame(
  profileId: ProfileId | null,
  characterId: CharacterId | null,
  occupancy: LobbyOccupancy,
): boolean {
  if (!profileId || !characterId) return false;
  return !isProfileOccupied(occupancy, profileId) && !isCharacterOccupied(occupancy, characterId);
}
