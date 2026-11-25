import { useCallback, useEffect, useState } from 'react';
import { KITCHEN_STATIONS, type RoomId, type StationId } from './config/kitchenLayout';
import { MARKET_SPAWN, type MarketStallId } from './config/marketLayout';
import { PROFILES, type ProfileId } from './config/profiles';
import { kitchenAudio } from './domain/audio';
import { getTranslations } from './i18n/translations';
import { restoreAuthSession, signOutProfile } from './services/supabase/auth';
import {
  acquireStationLock,
  fetchHomeSnapshot,
  heartbeatStationLock,
  releaseStationLock,
} from './services/supabase/homeRepository';
import { kitchenRealtime } from './services/supabase/realtimeSync';
import { playerMotionStore } from './store/playerMotionStore';
import { useGameStore } from './store/useGameStore';
import { useLanguageStore } from './store/useLanguageStore';
import { useSessionStore, type BackendMode } from './store/useSessionStore';
import { KitchenCanvas } from './scene/KitchenCanvas';
import { ProfilePinGate } from './ui/auth/ProfilePinGate';
import { LandscapeGuard } from './ui/guards/LandscapeGuard';
import { ToastLayer } from './ui/hud/ToastLayer';
import { TopHudBar } from './ui/hud/TopHudBar';
import { ChoppingMiniGame } from './ui/minigames/ChoppingMiniGame';
import { CookingMiniGame } from './ui/minigames/CookingMiniGame';
import { FridgeModal } from './ui/modals/FridgeModal';
import { MarketModal } from './ui/modals/MarketModal';
import { RecipeBookModal } from './ui/modals/RecipeBookModal';
import { SettingsModal } from './ui/modals/SettingsModal';

export default function App() {
  const [booting, setBooting] = useState(true);
  const profileId = useSessionStore((s) => s.profileId);
  const setSession = useSessionStore((s) => s.setSession);
  const resetSession = useSessionStore((s) => s.resetSession);

  const setCurrentRoom = useGameStore((s) => s.setCurrentRoom);
  const openMarketStall = useGameStore((s) => s.openMarketStall);
  const activeOverlay = useGameStore((s) => s.activeOverlay);
  const heldLockStation = useGameStore((s) => s.heldLockStation);
  const setActiveOverlay = useGameStore((s) => s.setActiveOverlay);
  const setHeldLockStation = useGameStore((s) => s.setHeldLockStation);
  const pushToast = useGameStore((s) => s.pushToast);

  const lang = useLanguageStore((s) => s.lang);
  const t = getTranslations(lang);

  // Global iOS Safari Web Audio unlock on first touch/pointer interaction
  useEffect(() => {
    const unlock = () => {
      kitchenAudio.unlockSync();
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, []);

  // Restore saved session on load
  useEffect(() => {
    let mounted = true;
    void restoreAuthSession().then((res) => {
      if (!mounted) return;
      if (res.ok && res.profileId) {
        setSession(res.profileId, res.backendMode);
      }
      setBooting(false);
    });
    return () => {
      mounted = false;
    };
  }, [setSession]);

  // Connect persistent home + Realtime channel when signed in
  useEffect(() => {
    if (!profileId) return;

    const [sx, sz] = PROFILES[profileId].spawnPosition;
    setCurrentRoom('kitchen');
    playerMotionStore.resetLocal(sx, sz, 'kitchen');

    let cancelled = false;
    void fetchHomeSnapshot().then((snap) => {
      if (cancelled) return;
      const prof = snap.profiles[profileId];
      const displayName = prof?.displayName ?? PROFILES[profileId].defaultName;
      const characterId = prof?.characterId ?? PROFILES[profileId].defaultCharacter;
      kitchenRealtime.connect(profileId, displayName, characterId);
    });

    return () => {
      cancelled = true;
      kitchenRealtime.disconnect();
    };
  }, [profileId, setCurrentRoom]);

  // Maintain station lock TTL heartbeat (10s) and clean release on pagehide
  useEffect(() => {
    if (!profileId || !heldLockStation) return;

    const timer = window.setInterval(() => {
      void heartbeatStationLock(heldLockStation, profileId, 25);
    }, 10_000);

    const handlePageHide = () => {
      void releaseStationLock(heldLockStation, profileId);
    };
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [profileId, heldLockStation]);

  const releaseActiveStation = useCallback(async () => {
    const lockStation = useGameStore.getState().heldLockStation;
    const activeProfile = useSessionStore.getState().profileId;
    setActiveOverlay(null);
    playerMotionStore.setLocalInteracting(false);
    kitchenRealtime.updatePresenceStation(null);
    kitchenRealtime.sendImmediateState();

    if (lockStation && activeProfile) {
      setHeldLockStation(null);
      await releaseStationLock(lockStation, activeProfile);
    }
  }, [setActiveOverlay, setHeldLockStation]);

  const handleEnterRoom = useCallback(
    async (targetRoom: RoomId) => {
      if (!profileId) return;
      await releaseActiveStation();
      setCurrentRoom(targetRoom);

      const [sx, sz] =
        targetRoom === 'market' ? MARKET_SPAWN[profileId] : [-2.2, 1.85];
      playerMotionStore.resetLocal(sx, sz, targetRoom);
      kitchenRealtime.updatePresenceRoom(targetRoom);
      kitchenAudio.playFlip();
      const curT = getTranslations(useLanguageStore.getState().lang);
      pushToast(
        targetRoom === 'market' ? curT.enteredMarketToast : curT.enteredKitchenToast,
        'info',
      );
    },
    [profileId, pushToast, releaseActiveStation, setCurrentRoom],
  );

  const handleArriveAtStation = useCallback(
    async (stationId: StationId) => {
      if (!profileId) return;
      const def = KITCHEN_STATIONS[stationId];

      if (!def.requiresLock) {
        kitchenAudio.playTap();
        setActiveOverlay(stationId);
        return;
      }

      const res = await acquireStationLock(stationId, profileId, 25);
      if (!res.acquired) {
        kitchenAudio.playError();
        const curT = getTranslations(useLanguageStore.getState().lang);
        const locker =
          res.lockedBy
            ? useGameStore.getState().profiles[res.lockedBy]?.displayName ??
              PROFILES[res.lockedBy].defaultName
            : 'Partner';
        pushToast(curT.stationLockedToast(locker, curT.stations[stationId].label), 'warn');
        return;
      }

      setHeldLockStation(stationId);
      playerMotionStore.setLocalInteracting(true, def.facingAngle);
      kitchenRealtime.updatePresenceStation(stationId);
      kitchenRealtime.sendImmediateState();
      setActiveOverlay(stationId);
    },
    [profileId, pushToast, setActiveOverlay, setHeldLockStation],
  );

  const handleArriveAtMarketStall = useCallback(
    (stallId: MarketStallId) => {
      kitchenAudio.playTap();
      openMarketStall(stallId);
    },
    [openMarketStall],
  );

  const handleSignedIn = (nextProfile: ProfileId, mode: BackendMode) => {
    setSession(nextProfile, mode);
  };

  const handleSignOut = async () => {
    await releaseActiveStation();
    kitchenRealtime.disconnect();
    await signOutProfile();
    resetSession();
  };

  if (booting) {
    return (
      <div
        className="flex h-dvh w-dvw items-center justify-center text-sm font-bold"
        style={{ background: 'var(--bg-app)', color: 'var(--text-main)' }}
      >
        {t.loadingKitchen}
      </div>
    );
  }

  return (
    <>
      <LandscapeGuard />

      {!profileId ? (
        <ProfilePinGate onSignedIn={handleSignedIn} />
      ) : (
        <div
          className="game-shell relative h-dvh w-dvw overflow-hidden"
          style={{ background: 'var(--bg-app)' }}
        >
          <KitchenCanvas
            profileId={profileId}
            onArriveAtStation={(st) => void handleArriveAtStation(st)}
            onArriveAtMarketStall={handleArriveAtMarketStall}
            onEnterRoom={(room) => void handleEnterRoom(room)}
          />

          <TopHudBar profileId={profileId} />
          <ToastLayer />

          <FridgeModal
            open={activeOverlay === 'fridge'}
            onClose={() => setActiveOverlay(null)}
          />
          <MarketModal
            open={activeOverlay === 'market_stall'}
            onClose={() => setActiveOverlay(null)}
          />
          <RecipeBookModal
            open={activeOverlay === 'recipe_book'}
            profileId={profileId}
            onClose={() => setActiveOverlay(null)}
          />
          <SettingsModal
            open={activeOverlay === 'settings'}
            onClose={() => setActiveOverlay(null)}
            onSignOut={() => void handleSignOut()}
          />
          <ChoppingMiniGame
            open={activeOverlay === 'cutting_board'}
            profileId={profileId}
            onClose={() => void releaseActiveStation()}
          />
          <CookingMiniGame
            open={activeOverlay === 'stove'}
            profileId={profileId}
            onClose={() => void releaseActiveStation()}
          />
        </div>
      )}
    </>
  );
}
