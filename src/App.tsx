import { useCallback, useEffect, useRef, useState } from 'react';
import { KITCHEN_STATIONS, type RoomId, type StationId } from './config/kitchenLayout';
import { MARKET_SPAWN, type MarketStallId } from './config/marketLayout';
import { PROFILES, type ProfileId } from './config/profiles';
import { RECIPES } from './config/recipes';
import { RESTAURANT_SPAWN, RESTAURANT_TABLES } from './config/restaurantLayout';
import { kitchenAudio } from './domain/audio';
import {
  DELIVERING_FINALIZE_SECONDS,
  SERVER_SPAWN_COOLDOWN_SECONDS,
  computeMaxActiveTables,
  electRestaurantHost,
  pickNextSpawnCandidate,
} from './domain/restaurantRules';
import { getTranslations } from './i18n/translations';
import { restoreAuthSession, signOutProfile } from './services/supabase/auth';
import {
  acquireStationLock,
  expireRestaurantOrders,
  fetchHomeSnapshot,
  heartbeatStationLock,
  releaseStationLock,
  spawnRestaurantOrder,
} from './services/supabase/homeRepository';
import { kitchenRealtime } from './services/supabase/realtimeSync';
import { playerMotionStore } from './store/playerMotionStore';
import { restaurantMotionStore } from './store/restaurantMotionStore';
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
import { ServicePassModal } from './ui/modals/ServicePassModal';
import { SettingsModal } from './ui/modals/SettingsModal';

export default function App() {
  const [booting, setBooting] = useState(true);
  const profileId = useSessionStore((s) => s.profileId);
  const setSession = useSessionStore((s) => s.setSession);
  const resetSession = useSessionStore((s) => s.resetSession);

  const setCurrentRoom = useGameStore((s) => s.setCurrentRoom);
  const openMarketStall = useGameStore((s) => s.openMarketStall);
  const loaded = useGameStore((s) => s.loaded);
  const orders = useGameStore((s) => s.orders);
  const activeOverlay = useGameStore((s) => s.activeOverlay);
  const heldLockStation = useGameStore((s) => s.heldLockStation);
  const setActiveOverlay = useGameStore((s) => s.setActiveOverlay);
  const setHeldLockStation = useGameStore((s) => s.setHeldLockStation);
  const pushToast = useGameStore((s) => s.pushToast);

  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const seededOrdersRef = useRef(false);

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

  // Connect persistent home + Realtime channel when signed in (silently cleans up expired orders on boot)
  useEffect(() => {
    if (!profileId) return;

    const [sx, sz] = PROFILES[profileId].spawnPosition;
    setCurrentRoom('kitchen');
    playerMotionStore.resetLocal(sx, sz, 'kitchen');
    restaurantMotionStore.reset();
    seenOrderIdsRef.current.clear();
    seededOrdersRef.current = false;

    let cancelled = false;
    void fetchHomeSnapshot(true).then((snap) => {
      if (cancelled) return;
      seenOrderIdsRef.current = new Set(snap.orders.map((o) => o.id));
      seededOrdersRef.current = true;
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

  // Deterministic Presence Host (p1 priority): drives customer spawns & expiry cleanup
  useEffect(() => {
    if (!profileId) return;

    let running = false;
    const tick = async () => {
      if (running) return;
      const session = useSessionStore.getState();
      const onlineIds = Object.keys(session.onlineProfiles) as ProfileId[];
      const effectiveOnline = onlineIds.includes(profileId)
        ? onlineIds
        : [...onlineIds, profileId];

      if (!electRestaurantHost(effectiveOnline, profileId)) {
        return;
      }

      const game = useGameStore.getState();
      if (!game.loaded) return;

      running = true;
      try {
        const serverNowMs = Date.now() + game.clockOffsetMs;

        // 1. Expire timed-out waiting orders & finalize any stale delivering orders
        const needsCleanup = game.orders.some((o) => {
          if (o.status === 'waiting') {
            return new Date(o.expiresAt).getTime() <= serverNowMs;
          }
          if (o.status === 'delivering' && o.deliveredAt) {
            return (
              serverNowMs - new Date(o.deliveredAt).getTime() >=
              DELIVERING_FINALIZE_SECONDS * 1000
            );
          }
          return false;
        });

        if (needsCleanup) {
          const expRes = await expireRestaurantOrders();
          if (expRes.expiredCount > 0) {
            const curT = getTranslations(useLanguageStore.getState().lang);
            useGameStore.getState().pushToast(curT.orderExpiredToast, 'warn');
          }
        }

        // 2. Spawn next customer if Restaurant is OPEN, cooldown elapsed & under active table cap
        const latestGame = useGameStore.getState();
        if (!latestGame.restaurantOpen) return;

        const cooldownElapsed =
          !latestGame.lastOrderSpawnedAt ||
          Date.now() + latestGame.clockOffsetMs -
            new Date(latestGame.lastOrderSpawnedAt).getTime() >=
            SERVER_SPAWN_COOLDOWN_SECONDS * 1000;

        if (!cooldownElapsed) return;

        const onlineCount = Math.max(1, effectiveOnline.length);
        const curLang = useLanguageStore.getState().lang;
        const candidate = pickNextSpawnCandidate(
          latestGame.orders,
          onlineCount,
          curLang,
        );

        if (candidate) {
          const maxTables = computeMaxActiveTables(onlineCount);
          await spawnRestaurantOrder(candidate, maxTables);
        }
      } finally {
        running = false;
      }
    };

    const timer = window.setInterval(() => {
      void tick();
    }, 3000);

    return () => window.clearInterval(timer);
  }, [profileId]);

  // Show a single clickable notification whenever a brand-new waiting order arrives (for both players)
  useEffect(() => {
    if (!profileId || !loaded || !seededOrdersRef.current) return;

    const curT = getTranslations(useLanguageStore.getState().lang);
    for (const order of orders) {
      if (order.status !== 'waiting') continue;
      if (seenOrderIdsRef.current.has(order.id)) continue;
      seenOrderIdsRef.current.add(order.id);

      const recipe = RECIPES[order.recipeId];
      const tableNum = RESTAURANT_TABLES[order.tableId].tableNumber;
      kitchenAudio.playBell();
      pushToast(
        curT.newOrderToast(
          tableNum,
          recipe.icon,
          curT.recipes[order.recipeId].name,
          order.customerName,
          curT.difficultyLabels[order.difficulty],
        ),
        'order',
        'service_pass',
      );
    }
  }, [profileId, loaded, orders, pushToast]);

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
      const fromRoom = useGameStore.getState().currentRoom;
      await releaseActiveStation();
      setCurrentRoom(targetRoom);

      const [sx, sz]: readonly [number, number] =
        targetRoom === 'market'
          ? MARKET_SPAWN[profileId]
          : targetRoom === 'restaurant'
            ? RESTAURANT_SPAWN[profileId]
            : fromRoom === 'restaurant'
              ? [2.75, 2.05]
              : [-2.2, 1.85];

      playerMotionStore.resetLocal(sx, sz, targetRoom);
      kitchenRealtime.updatePresenceRoom(targetRoom);
      kitchenAudio.playFlip();
      const curT = getTranslations(useLanguageStore.getState().lang);
      pushToast(
        targetRoom === 'market'
          ? curT.enteredMarketToast
          : targetRoom === 'restaurant'
            ? curT.enteredRestaurantToast
            : curT.enteredKitchenToast,
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

  const handleArriveAtServicePass = useCallback(() => {
    kitchenAudio.playBell();
    setActiveOverlay('service_pass');
  }, [setActiveOverlay]);

  const handleSignedIn = (nextProfile: ProfileId, mode: BackendMode) => {
    setSession(nextProfile, mode);
  };

  const handleSignOut = async () => {
    await releaseActiveStation();
    kitchenRealtime.disconnect();
    restaurantMotionStore.reset();
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
            onArriveAtServicePass={handleArriveAtServicePass}
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
          <ServicePassModal
            open={activeOverlay === 'service_pass'}
            profileId={profileId}
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
