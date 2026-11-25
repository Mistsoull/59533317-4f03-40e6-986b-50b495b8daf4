import { useEffect, useRef, useState } from 'react';
import { Bell, Flame, PauseCircle, PlayCircle, Send } from 'lucide-react';
import type { ProfileId } from '../../config/profiles';
import { RECIPES } from '../../config/recipes';
import { RESTAURANT_TABLES } from '../../config/restaurantLayout';
import { kitchenAudio } from '../../domain/audio';
import {
  evaluateOrderPatience,
  formatRemainingTime,
} from '../../domain/restaurantRules';
import { getTranslations } from '../../i18n/translations';
import {
  serveRestaurantOrder,
  setRestaurantOpen,
} from '../../services/supabase/homeRepository';
import { useGameStore } from '../../store/useGameStore';
import { useLanguageStore } from '../../store/useLanguageStore';

interface OrderTicketBarProps {
  profileId: ProfileId;
}

/**
 * Compact live Order Ticket Bar visible across ALL rooms (Kitchen, Market, Restaurant).
 * Uses a single lightweight 350ms timer (NEVER 60fps React re-renders) + server clockOffsetMs.
 */
export function OrderTicketBar({ profileId }: OrderTicketBarProps) {
  const orders = useGameStore((s) => s.orders);
  const inventory = useGameStore((s) => s.inventory);
  const restaurantOpen = useGameStore((s) => s.restaurantOpen);
  const serviceStreak = useGameStore((s) => s.serviceStreak);
  const clockOffsetMs = useGameStore((s) => s.clockOffsetMs);
  const pushToast = useGameStore((s) => s.pushToast);

  const lang = useLanguageStore((s) => s.lang);
  const t = getTranslations(lang);

  const [nowMs, setNowMs] = useState(() => Date.now() + clockOffsetMs);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [togglingOpen, setTogglingOpen] = useState(false);
  const urgentAlertedRef = useRef<Set<string>>(new Set());

  const hasWaitingOrders = orders.some((o) => o.status === 'waiting');

  // Lightweight 350ms countdown refresh ONLY while waiting orders exist
  useEffect(() => {
    setNowMs(Date.now() + clockOffsetMs);
    if (!hasWaitingOrders) return;
    const id = window.setInterval(() => {
      setNowMs(Date.now() + useGameStore.getState().clockOffsetMs);
    }, 350);
    return () => window.clearInterval(id);
  }, [hasWaitingOrders, clockOffsetMs]);

  // Play gentle urgent chime once per order crossing into <20% patience
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

  const handleToggleOpen = async () => {
    if (togglingOpen) return;
    kitchenAudio.unlockSync();
    setTogglingOpen(true);
    const nextOpen = !restaurantOpen;
    const res = await setRestaurantOpen(nextOpen);
    setTogglingOpen(false);
    if (res.ok) {
      if (nextOpen) {
        kitchenAudio.playBell();
        pushToast(t.restaurantOpenedToast, 'success');
      } else {
        kitchenAudio.playTap();
        pushToast(t.restaurantClosedToast, 'info');
      }
    }
  };

  const handleDispatch = async (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.status !== 'waiting' || busyOrderId) return;

    kitchenAudio.unlockSync();
    setBusyOrderId(orderId);
    const res = await serveRestaurantOrder(profileId, order.id, order.recipeId);
    setBusyOrderId(null);

    if (res.ok) {
      kitchenAudio.playBell();
      kitchenAudio.playCoin();
      const tableNum = RESTAURANT_TABLES[order.tableId].tableNumber;
      const dishName = t.recipes[order.recipeId].name;
      pushToast(
        t.orderDispatchedToast(
          tableNum,
          dishName,
          res.rewardCoins + res.tipCoins,
          res.tipCoins,
        ),
        'success',
      );
    } else {
      kitchenAudio.playError();
      pushToast(t.orderAlreadyHandledToast, 'warn');
    }
  };

  const activeOrders = orders.filter(
    (o) => o.status === 'waiting' || o.status === 'delivering',
  );

  return (
    <aside
      aria-label={t.waitingOrdersHeading}
      className="pointer-events-none fixed inset-x-0 top-14 z-10 flex flex-wrap items-start gap-1.5 safe-x"
    >
      {/* Restaurant Open / Pause Toggle Pill */}
      <div className="pointer-events-auto flex items-center gap-1.5">
        <button
          type="button"
          disabled={togglingOpen}
          onClick={() => void handleToggleOpen()}
          className={`ui-card inline-flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-xs font-extrabold shadow-md backdrop-blur-md transition active:scale-95 disabled:opacity-60 ${
            restaurantOpen
              ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
              : 'border-amber-500/45 text-amber-800 dark:text-amber-200'
          }`}
        >
          {restaurantOpen ? (
            <>
              <PauseCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
              <span>{t.restaurantOpenBadge}</span>
            </>
          ) : (
            <>
              <PlayCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" aria-hidden="true" />
              <span>
                {t.restaurantClosedBadge} · {t.openRestaurantBtn}
              </span>
            </>
          )}
        </button>

        {serviceStreak >= 2 && (
          <div className="ui-card inline-flex items-center gap-1 rounded-2xl px-2.5 py-1.5 text-xs font-extrabold text-orange-600 shadow-md backdrop-blur-md dark:text-orange-300">
            <Flame className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{serviceStreak}</span>
          </div>
        )}
      </div>

      {/* Live Order Tickets (up to 3 compact cards) */}
      {activeOrders.map((order) => {
        const recipe = RECIPES[order.recipeId];
        const tableNum = RESTAURANT_TABLES[order.tableId].tableNumber;
        const cookedHave = inventory[recipe.cookedItemId] ?? 0;
        const isDelivering = order.status === 'delivering';
        const patience = evaluateOrderPatience(order.createdAt, order.expiresAt, nowMs);
        const canSend = !isDelivering && !patience.isExpired && cookedHave > 0;

        const barColor =
          patience.level === 'happy'
            ? 'bg-emerald-500'
            : patience.level === 'impatient'
              ? 'bg-amber-500'
              : 'bg-rose-500';

        const diffBadge =
          order.difficulty === 'easy'
            ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-200'
            : order.difficulty === 'medium'
              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-200'
              : 'bg-rose-500/20 text-rose-700 dark:text-rose-200';

        return (
          <div
            key={order.id}
            className={`pointer-events-auto ui-card flex min-w-[168px] max-w-[235px] flex-col gap-1 rounded-2xl border px-2.5 py-1.5 shadow-md backdrop-blur-md ${
              isDelivering
                ? 'border-sky-500/45'
                : patience.level === 'urgent'
                  ? 'border-rose-500/60 ring-1 ring-rose-500/40'
                  : 'border-black/10 dark:border-white/10'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1">
                <span className="rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-800 dark:text-amber-200">
                  {t.tableShort(tableNum)}
                </span>
                <span className="text-sm leading-none" aria-hidden="true">
                  {recipe.icon}
                </span>
                <span className="truncate text-[11px] font-extrabold">
                  {t.recipes[recipe.id].name}
                </span>
              </div>

              <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold ${diffBadge}`}>
                {t.difficultyLabels[order.difficulty]}
              </span>
            </div>

            {isDelivering ? (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-sky-500/15 px-2 py-1 text-[10px] font-extrabold text-sky-700 dark:text-sky-200">
                <span>🤵 {t.waiterDeliveringShort}</span>
                <span className="text-emerald-700 dark:text-emerald-300">
                  +🪙 {order.rewardCoins + order.tipCoins}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <div className="flex flex-1 flex-col gap-0.5">
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="truncate ui-muted">{order.customerName}</span>
                    <span
                      className={
                        patience.level === 'urgent'
                          ? 'animate-pulse font-extrabold text-rose-600 dark:text-rose-300'
                          : 'tabular-nums'
                      }
                    >
                      {formatRemainingTime(patience.remainingMs)}
                    </span>
                  </div>
                  <div className="ui-subtle h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 ${barColor}`}
                      style={{ width: `${Math.round(patience.ratio * 100)}%` }}
                    />
                  </div>
                </div>

                {canSend ? (
                  <button
                    type="button"
                    disabled={busyOrderId === order.id}
                    onClick={() => void handleDispatch(order.id)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-emerald-600 px-2 py-1 text-[10px] font-extrabold text-white shadow-sm transition active:scale-95 disabled:opacity-50"
                  >
                    <Send className="h-3 w-3" aria-hidden="true" />
                    <span>{t.sendToWaiterBtn}</span>
                  </button>
                ) : (
                  <span
                    title={t.needCookedBtn}
                    className="ui-subtle inline-flex shrink-0 items-center gap-0.5 rounded-lg px-1.5 py-1 text-[10px] font-bold ui-muted"
                  >
                    <Bell className="h-3 w-3 opacity-60" aria-hidden="true" />
                    <span>{t.needCookedBtn}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}
