import { describe, expect, it } from 'vitest';
import {
  EMPTY_LOBBY_OCCUPANCY,
  areAllProfilesOccupied,
  buildLobbyOccupancy,
  canEnterGame,
  isCharacterOccupied,
  isProfileOccupied,
  pickAvailableCharacter,
  pickAvailableProfile,
} from '../domain/lobbyOccupancy';

describe('lobbyOccupancy', () => {
  it('marks active profile and character as occupied while keeping others free', () => {
    const occ = buildLobbyOccupancy([
      { profileId: 'p1', displayName: 'Uğur', characterId: 'bubu' },
    ]);

    expect(isProfileOccupied(occ, 'p1')).toBe(true);
    expect(isProfileOccupied(occ, 'p2')).toBe(false);
    expect(isCharacterOccupied(occ, 'bubu')).toBe(true);
    expect(isCharacterOccupied(occ, 'dudu')).toBe(false);
    expect(isCharacterOccupied(occ, 'cat')).toBe(false);
    expect(areAllProfilesOccupied(occ)).toBe(false);
  });

  it('auto-picks an available profile and character when preferred options are occupied', () => {
    const occ = buildLobbyOccupancy([
      { profileId: 'p1', displayName: 'Şef 1', characterId: 'dudu' },
    ]);

    expect(pickAvailableProfile('p1', occ)).toBe('p2');
    expect(pickAvailableProfile('p2', occ)).toBe('p2');
    expect(pickAvailableCharacter('dudu', occ)).toBe('bubu');
    expect(pickAvailableCharacter('cat', occ)).toBe('cat');
  });

  it('blocks entry when selected profile or character is occupied or when room is full', () => {
    const oneTaken = buildLobbyOccupancy([
      { profileId: 'p1', displayName: 'Uğur', characterId: 'cat' },
    ]);

    expect(canEnterGame('p1', 'bubu', oneTaken)).toBe(false);
    expect(canEnterGame('p2', 'cat', oneTaken)).toBe(false);
    expect(canEnterGame('p2', 'bubu', oneTaken)).toBe(true);
    expect(canEnterGame('p1', 'bubu', EMPTY_LOBBY_OCCUPANCY)).toBe(true);

    const bothTaken = buildLobbyOccupancy([
      { profileId: 'p1', displayName: 'Uğur', characterId: 'bubu' },
      { profileId: 'p2', displayName: 'Partner', characterId: 'dudu' },
    ]);

    expect(areAllProfilesOccupied(bothTaken)).toBe(true);
    expect(pickAvailableProfile('p1', bothTaken)).toBeNull();
    expect(canEnterGame('p1', 'cat', bothTaken)).toBe(false);
    expect(canEnterGame('p2', 'dog', bothTaken)).toBe(false);
  });
});
