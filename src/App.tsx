import { useCallback, useEffect, useState } from 'react';
import { KITCHEN_STATIONS, type StationId } from './config/kitchenLayout';
import { PROFILES, type ProfileId } from './config/profiles';
import { kitchenAudio } from './domain/audio';
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

export default function App() {
  const [booting, setBooting] = useState(true);
  const profileId = useSessionStore((s) => s.profileId);
  const setSession = useSessionStore((s) => s.setSession);
  const resetSession = useSessionStore((s) => s.resetSession);

  const activeOverlay = useGameStore((s) => s.activeOverlay);
  const heldLockStation = useGameStore((s) => s.heldLockStation);
  const setActiveOverlay = useGameStore((s) => s.setActiveOverlay);
  const setHeldLockStation = useGameStore((s) => s.setHeldLockStation);
  const pushToast = useGameStore((s) => s.pushToast);

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
    playerMotionStore.resetLocal(sx, sz);

    let cancelled = false;
    void fetchHomeSnapshot().then((snap) => {
      if (cancelled) return;
      const displayName = snap.profiles[profileId]?.displayName ?? PROFILES[profileId].defaultName;
      kitchenRealtime.connect(profileId, displayName);
    });

    return () => {
      cancelled = true;
      kitchenRealtime.disconnect();
    };
  }, [profileId]);

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
        const locker =
          res.lockedBy
            ? useGameStore.getState().profiles[res.lockedBy]?.displayName ??
              PROFILES[res.lockedBy].defaultName
            : 'Partnerin';
        pushToast(`🔒 ${locker} şu an ${def.label} istasyonunu kullanıyor!`, 'warn');
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
      <div className="flex h-dvh w-dvw items-center justify-center bg-[#1e1b18] text-sm font-semibold text-amber-200">
        🍳 Mutfak hazırlanıyor...
      </div>
    );
  }

  return (
    <>
      <LandscapeGuard />

      {!profileId ? (
        <ProfilePinGate onSignedIn={handleSignedIn} />
      ) : (
        <div className="game-shell relative h-dvh w-dvw overflow-hidden bg-[#1e1b18]">
          <KitchenCanvas
            profileId={profileId}
            onArriveAtStation={(st) => void handleArriveAtStation(st)}
          />

          <TopHudBar profileId={profileId} onSignOut={() => void handleSignOut()} />
          <ToastLayer />

          {/* Subtle bottom control tip */}
          <div className="pointer-events-none fixed bottom-2 left-3 z-10 rounded-xl border border-white/10 bg-stone-950/65 px-3 py-1.5 text-[11px] text-stone-300 backdrop-blur-xs safe-bottom safe-x">
            👆 Zemine dokun yürü · İstasyonlara dokun etkileş
          </div>

          {/* Modals & Station Mini-Games */}
          <FridgeModal
            open={activeOverlay === 'fridge'}
            onClose={() => setActiveOverlay(null)}
          />
          <MarketModal
            open={activeOverlay === 'market'}
            onClose={() => setActiveOverlay(null)}
          />
          <RecipeBookModal
            open={activeOverlay === 'recipe_book'}
            profileId={profileId}
            onClose={() => setActiveOverlay(null)}
          />
          <ChoppingMiniGame
            open={activeOverlay === 'cutting_board'}
            profileId={profileId}
            onClose={() => void releaseActiveStation()}
            onOpenMarket={() => {
              void releaseActiveStation().then(() => setActiveOverlay('market'));
            }}
          />
          <CookingMiniGame
            open={activeOverlay === 'stove'}
            profileId={profileId}
            onClose={() => void releaseActiveStation()}
            onOpenMarket={() => {
              void releaseActiveStation().then(() => setActiveOverlay('market'));
            }}
          />
        </div>
      )}
    </>
  );
}
