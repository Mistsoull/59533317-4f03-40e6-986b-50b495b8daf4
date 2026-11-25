import { describe, expect, it } from 'vitest';
import {
  PARTNER_BROADCAST_GRACE_MS,
  isFinalPresenceLeave,
  isInitialPresenceJoin,
  reconcileOnlineProfiles,
  shouldExpirePartner,
} from '../domain/partnerPresence';
import type { PresencePayload } from '../services/supabase/types';

function makePresence(
  profileId: 'p1' | 'p2',
  overrides: Partial<PresencePayload> = {},
): PresencePayload {
  return {
    profileId,
    displayName: profileId === 'p1' ? 'Şef 1' : 'Şef 2',
    characterId: profileId === 'p1' ? 'bubu' : 'dudu',
    room: 'kitchen',
    onlineAt: new Date(1_000_000).toISOString(),
    activeStationId: null,
    ...overrides,
  };
}

describe('partnerPresence', () => {
  it('keeps partner online during transient Presence drop when Broadcast arrived within grace window', () => {
    const now = 1_010_000;
    const res = reconcileOnlineProfiles({
      myProfileId: 'p1',
      presenceMap: { p1: makePresence('p1') },
      existingOnline: {
        p1: makePresence('p1'),
        p2: makePresence('p2', { displayName: 'Büşra', characterId: 'cat', room: 'market' }),
      },
      partnerHint: {
        profileId: 'p2',
        room: 'market',
        lastBroadcastAt: now - 3000,
        displayName: 'Büşra',
        characterId: 'cat',
      },
      nowMs: now,
    });

    expect(res.partnerVisible).toBe(true);
    expect(res.partnerFromPresence).toBe(false);
    expect(res.onlineProfiles.p2?.displayName).toBe('Büşra');
    expect(res.onlineProfiles.p2?.characterId).toBe('cat');
    expect(res.onlineProfiles.p2?.room).toBe('market');
  });

  it('expires partner cleanly when absent from Presence and Broadcast exceeds grace window', () => {
    const now = 1_020_000;
    const res = reconcileOnlineProfiles({
      myProfileId: 'p1',
      presenceMap: { p1: makePresence('p1') },
      existingOnline: {
        p1: makePresence('p1'),
        p2: makePresence('p2'),
      },
      partnerHint: {
        profileId: 'p2',
        room: 'kitchen',
        lastBroadcastAt: now - PARTNER_BROADCAST_GRACE_MS,
        displayName: 'Şef 2',
        characterId: 'dudu',
      },
      nowMs: now,
    });

    expect(res.partnerVisible).toBe(false);
    expect(res.partnerFromPresence).toBe(false);
    expect(res.onlineProfiles.p2).toBeUndefined();
    expect(shouldExpirePartner(false, now - PARTNER_BROADCAST_GRACE_MS, now)).toBe(true);
    expect(shouldExpirePartner(false, now - 4000, now)).toBe(false);
    expect(shouldExpirePartner(true, 0, now)).toBe(false);
  });

  it('filters out Phoenix track() churn in join/leave helper predicates', () => {
    expect(isInitialPresenceJoin(1, 1)).toBe(true);
    expect(isInitialPresenceJoin(2, 1)).toBe(false);
    expect(isInitialPresenceJoin(0, 0)).toBe(false);

    expect(isFinalPresenceLeave(0)).toBe(true);
    expect(isFinalPresenceLeave(1)).toBe(false);
  });

  it('prefers fresher Broadcast room over stale Presence room without flickering', () => {
    const presenceAt = 1_000_000;
    const now = 1_006_000;
    const res = reconcileOnlineProfiles({
      myProfileId: 'p1',
      presenceMap: {
        p1: makePresence('p1'),
        p2: makePresence('p2', {
          room: 'kitchen',
          onlineAt: new Date(presenceAt).toISOString(),
        }),
      },
      existingOnline: {},
      partnerHint: {
        profileId: 'p2',
        room: 'restaurant',
        lastBroadcastAt: presenceAt + 2500,
        displayName: 'Şef 2',
        characterId: 'dudu',
      },
      nowMs: now,
    });

    expect(res.partnerVisible).toBe(true);
    expect(res.partnerFromPresence).toBe(true);
    expect(res.onlineProfiles.p2?.room).toBe('restaurant');
  });
});
