import type { CharacterId } from './characters';

export type ProfileId = 'p1' | 'p2';

export interface ProfileDefinition {
  id: ProfileId;
  email: string;
  defaultName: string;
  defaultCharacter: CharacterId;
  avatarColor: string;
  accentColor: string;
  spawnPosition: readonly [number, number];
}

export const PROFILES: Record<ProfileId, ProfileDefinition> = {
  p1: {
    id: 'p1',
    email: 'p1@home.local',
    defaultName: 'Şef 1',
    defaultCharacter: 'bubu',
    avatarColor: '#e07a5f',
    accentColor: '#fde8e1',
    spawnPosition: [-1.4, -0.3],
  },
  p2: {
    id: 'p2',
    email: 'p2@home.local',
    defaultName: 'Şef 2',
    defaultCharacter: 'dudu',
    avatarColor: '#3d9970',
    accentColor: '#e2f7ec',
    spawnPosition: [1.4, -0.3],
  },
};

export const PROFILE_LIST: readonly ProfileDefinition[] = [PROFILES.p1, PROFILES.p2];

export const DEFAULT_LOCAL_PIN = '1234';

/**
 * Formats the shared 4-6 digit PIN into a deterministic Supabase Auth password
 * satisfying the minimum 6-character password length requirement.
 */
export function formatPinPassword(pin: string): string {
  return `${pin.trim()}_kitchen_home_v1`;
}
