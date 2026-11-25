import { useEffect, useRef, useState } from 'react';
import { Bell, BookOpen, Settings } from 'lucide-react';
import type { ProfileId } from '../../config/profiles';
import { RECIPES, RECIPE_LIST } from '../../config/recipes';
import { kitchenAudio } from '../../domain/audio';
import { evaluateOrderPatience } from '../../domain/restaurantRules';
import { getTranslations } from '../../i18n/translations';
import { useGameStore } from '../../store/useGameStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import { useSettingsStore } from '../../store/useSettingsStore';

interface TopHudBarProps {
  profileId: ProfileId;
}

/**
 * Clean minimal landscape HUD:
 * - Left: Coins ONLY (fixed online/offline status pill removed)
 * - Right: Orders Popup button (centered ServicePassModal) + Recipe Book + Settings gear
 */
export function TopHudBar({ profileId: _profileId }: TopHudBarProps) {
  const coins = useGameStore((s) => s.coins);
  const recipes = useGameStore((s) => s.recipes);
  const orders = useGameStore((s) => s.orders);
  const inventory = useGameStore((s) => s.inventory);
  const restaurantOpen = useGameStore((s) => s.restaurantOpen);
  const clockOffsetMs = useGameStore((s) => s.clockOffsetMs);
  const setActiveOverlay = useGameStore((s) => s.setActiveOverlay);

  const lang = useLanguageStore((s) => s.lang);
  const showRealLifeRecipes = useSettingsStore((s) => s.showRealLifeRecipes);
  const t = getTranslations(lang);

  const [nowMs, setNowMs] = useState(() => Date.now() + clockOffsetMs);
  const urgentAlertedRef = useRef<Set<string>>(new Set());

  const activeOrders = orders.filter(
    (o) => o.status === 'waiting' || o.status === 'delivering',
  );
  const hasWaiting = activeOrders.some((o) => o.status === 'waiting');

  // Lightweight 500ms check ONLY while waiting orders exist (zero 60fps re-renders)
  useEffect(() => {
    setNowMs(Date.now() + clockOffsetMs);
    if (!hasWaiting) return;
    const id = window.setInterval(() => {
      setNowMs(Date.now() + useGameStore.getState().clockOffsetMs);
    }, 500);
    return () => window.clearInterval(id);
  }, [hasWaiting, clockOffsetMs]);

  let hasUrgent = false;
  let readyToSendCount = 0;
  for (const order of activeOrders) {
    if (order.status !== 'waiting') continue;
    const snap = evaluateOrderPatience(order.createdAt, order.expiresAt, nowMs);
    if (snap.level === 'urgent') {
      hasUrgent = true;
    }
    const cookedHave = inventory[RECIPES[order.recipeId].cookedItemId] ?? 0;
    if (!snap.isExpired && cookedHave > 0) {
      readyToSendCount += 1;
    }
  }

  // Play gentle urgent chime once per order entering <20% remaining patience
  useEffect(() => {
    for (const order of orders) {
      if (order.status !== 'waiting') continue;
      const snap = evaluateOrderPatience(order.createdAt, order.expiresAt, nowMs);
      if (snap.level === 'urgent' && !urgentAlertedRef.current.has(order.id)) {
        urgentAlertedRef.current.add(order.id);
        kitchenAudio.playUrgent();
      }
    }
  }, [orders, nowMs]);

  const irlDoneCount = RECIPE_LIST.filter((r) => recipes[r.id]?.irlCookedCount > 0).length;

  const ordersBtnRing =
    readyToSendCount > 0
      ? 'border-emerald-500/60 ring-2 ring-emerald-400/50'
      : hasUrgent
        ? 'border-rose-500/60 ring-2 ring-rose-400/50'
        : '';

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-center justify-between gap-2 safe-top safe-x">
      {/* Left minimal cluster: Coins only */}
      <div className="pointer-events-auto flex items-center gap-1.5">
        <div className="ui-card flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-sm font-extrabold shadow-md backdrop-blur-md">
          <span aria-hidden="true">🪙</span>
          <span className="text-amber-600 dark:text-amber-300">{coins}</span>
        </div>
      </div>

      {/* Right minimal action cluster: Orders popup + Recipe Book + Settings */}
      <div className="pointer-events-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            kitchenAudio.unlockSync();
            kitchenAudio.playTap();
            setActiveOverlay('service_pass');
          }}
          className={`ui-card inline-flex items-center gap-1.5 rounded-2xl border px-3.5 py-2 text-xs font-extrabold shadow-md backdrop-blur-md transition active:scale-95 ${ordersBtnRing}`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              restaurantOpen ? 'bg-emerald-500' : 'bg-amber-400'
            }`}
            aria-hidden="true"
          />
          <Bell
            className={`h-4 w-4 ${
              readyToSendCount > 0
                ? 'animate-bounce text-emerald-600 dark:text-emerald-300'
                : hasUrgent
                  ? 'animate-pulse text-rose-600 dark:text-rose-300'
                  : 'text-amber-600 dark:text-amber-300'
            }`}
            aria-hidden="true"
          />
          <span>{t.ordersHudBtn}</span>
          {activeOrders.length > 0 && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold text-white ${
                readyToSendCount > 0
                  ? 'bg-emerald-600'
                  : hasUrgent
                    ? 'bg-rose-600'
                    : 'bg-amber-600'
              }`}
            >
              {activeOrders.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            kitchenAudio.unlockSync();
            kitchenAudio.playTap();
            setActiveOverlay('recipe_book');
          }}
          className="ui-card inline-flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-extrabold shadow-md backdrop-blur-md transition active:scale-95"
        >
          <BookOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
          <span>{t.recipeBook}</span>
          {showRealLifeRecipes && (
            <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-200">
              {irlDoneCount}/3
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            kitchenAudio.unlockSync();
            kitchenAudio.playTap();
            setActiveOverlay('settings');
          }}
          aria-label={t.settingsAria}
          className="ui-card inline-flex h-11 w-11 items-center justify-center rounded-2xl shadow-md backdrop-blur-md transition active:scale-95"
        >
          <Settings className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
