import type { CharacterId } from '../config/characters';
import type { RoomId } from '../config/kitchenLayout';
import type { ProfileId } from '../config/profiles';
import type { PresencePayload } from '../services/supabase/types';

export const PARTNER_BROADCAST_GRACE_MS = 10_000;

export interface PartnerBroadcastHint {
  profileId: ProfileId;
  room: RoomId;
  lastBroadcastAt: number;
  displayName: string;
  characterId: CharacterId;
}

export interface ReconcileOnlineProfilesParams {
  myProfileId: ProfileId;
  presenceMap: Partial<Record<ProfileId, PresencePayload>>;
  existingOnline: Partial<Record<ProfileId, PresencePayload>>;
  partnerHint: PartnerBroadcastHint | null;
  nowMs: number;
  graceMs?: number;
}

export interface ReconcileOnlineProfilesResult {
  onlineProfiles: Partial<Record<ProfileId, PresencePayload>>;
  partnerVisible: boolean;
  partnerFromPresence: boolean;
}

/**
 * Reconciles incoming Presence sync state with recent Broadcast packets so transient
 * Presence blips or channel rejoins do not hide an actively broadcasting partner.
 */
export function reconcileOnlineProfiles({
  myProfileId,
  presenceMap,
  existingOnline,
  partnerHint,
  nowMs,
  graceMs = PARTNER_BROADCAST_GRACE_MS,
}: ReconcileOnlineProfilesParams): ReconcileOnlineProfilesResult {
  const next: Partial<Record<ProfileId, PresencePayload>> = { ...presenceMap };
  const partnerId: ProfileId = myProfileId === 'p1' ? 'p2' : 'p1';
  const presencePartner = next[partnerId];

  if (presencePartner) {
    const parsedOnlineAt = Date.parse(presencePartner.onlineAt);
    const presenceOnlineAtMs = Number.isFinite(parsedOnlineAt) ? parsedOnlineAt : 0;
    const hintIsFresh =
      partnerHint !== null &&
      partnerHint.profileId === partnerId &&
      partnerHint.lastBroadcastAt > 0 &&
      nowMs - partnerHint.lastBroadcastAt < graceMs &&
      partnerHint.lastBroadcastAt > presenceOnlineAtMs;

    if (hintIsFresh) {
      next[partnerId] = {
        ...presencePartner,
        room: partnerHint.room,
      };
    }

    return {
      onlineProfiles: next,
      partnerVisible: true,
      partnerFromPresence: true,
    };
  }

  const withinGrace =
    partnerHint !== null &&
    partnerHint.profileId === partnerId &&
    partnerHint.lastBroadcastAt > 0 &&
    nowMs - partnerHint.lastBroadcastAt < graceMs;

  if (withinGrace) {
    const existing = existingOnline[partnerId];
    next[partnerId] = existing
      ? {
          ...existing,
          room: partnerHint.room,
        }
      : {
          profileId: partnerId,
          displayName: partnerHint.displayName,
          characterId: partnerHint.characterId,
          room: partnerHint.room,
          onlineAt: new Date(partnerHint.lastBroadcastAt).toISOString(),
          activeStationId: null,
        };

    return {
      onlineProfiles: next,
      partnerVisible: true,
      partnerFromPresence: false,
    };
  }

  return {
    onlineProfiles: next,
    partnerVisible: false,
    partnerFromPresence: false,
  };
}

/**
 * Determines whether a partner absent from Presence should now expire after grace window.
 */
export function shouldExpirePartner(
  inPresence: boolean,
  lastBroadcastAt: number,
  nowMs: number,
  graceMs = PARTNER_BROADCAST_GRACE_MS,
): boolean {
  return !inPresence && (lastBroadcastAt <= 0 || nowMs - lastBroadcastAt >= graceMs);
}

/**
 * True only when a presence key transitions from absent to present (ignores track() updates).
 */
export function isInitialPresenceJoin(
  currentPresencesCount: number,
  newPresencesCount: number,
): boolean {
  return currentPresencesCount <= newPresencesCount && newPresencesCount > 0;
}

/**
 * True only when the last presence meta for a key has left (ignores track() meta replacement).
 */
export function isFinalPresenceLeave(currentPresencesCount: number): boolean {
  return currentPresencesCount === 0;
}
