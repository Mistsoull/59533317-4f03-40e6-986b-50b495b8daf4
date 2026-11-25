import { useEffect, useState } from 'react';
import { Package, PauseCircle, PlayCircle, Send } from 'lucide-react';
import type { ProfileId } from '../../config/profiles';
import { RECIPE_LIST, RECIPES } from '../../config/recipes';
import { RESTAURANT_TABLES } from '../../config/restaurantLayout';
import { kitchenAudio } from '../../domain/audio';
import {
  evaluateOrderPatience,
  formatRemainingTime,
} from '../../domain/restaurantRules';
import { getTranslations } from '../../i18n/translations';
import {
  sellCookedDish,
  serveRestaurantOrder,
  setRestaurantOpen,
} from '../../services/supabase/homeRepository';
import { useGameStore } from '../../store/useGameStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import { ModalDialog } from '../common/ModalDialog';

interface ServicePassModalProps {
  open: boolean;
  profileId: ProfileId;
  onClose: () => void;
}

/**
 * Opened when tapping the Kitchen or Restaurant Service Pass Counter & Bell.
 * Lets players dispatch ready cooked dishes to the Waiter NPC, open/pause service,
 * or sell surplus cooked dishes as takeout via sell_cooked_dish RPC.
 */
export function ServicePassModal({
  open,
  profileId,
  onClose,
}: ServicePassModalProps) {
  const orders = useGameStore((s) => s.orders);
  const inventory = useGameStore((s) => s.inventory);
  const restaurantOpen = useGameStore((s) => s.restaurantOpen);
  const servedOrdersCount = useGameStore((s) => s.servedOrdersCount);
  const serviceStreak = useGameStore((s) => s.serviceStreak);
  const clockOffsetMs = useGameStore((s) => s.clockOffsetMs);
  const pushToast = useGameStore((s) => s.pushToast);

  const lang = useLanguageStore((s) => s.lang);
  const t = getTranslations(lang);

  const [nowMs, setNowMs] = useState(() => Date.now() + clockOffsetMs);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNowMs(Date.now() + clockOffsetMs);
    const id = window.setInterval(() => {
      setNowMs(Date.now() + useGameStore.getState().clockOffsetMs);
    }, 350);
    return () => window.clearInterval(id);
  }, [open, clockOffsetMs]);

  const handleToggleOpen = async () => {
    kitchenAudio.unlockSync();
    setBusyId('toggle');
    const nextOpen = !restaurantOpen;
    const res = await setRestaurantOpen(nextOpen);
    setBusyId(null);
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

  const handleDispatchOrder = async (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.status !== 'waiting') return;
    kitchenAudio.unlockSync();
    setBusyId(orderId);
    const res = await serveRestaurantOrder(profileId, order.id, order.recipeId);
    setBusyId(null);

    if (res.ok) {
      kitchenAudio.playBell();
      kitchenAudio.playCoin();
      pushToast(
        t.orderDispatchedToast(
          RESTAURANT_TABLES[order.tableId].tableNumber,
          t.recipes[order.recipeId].name,
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

  const handleSellTakeout = async (recipeId: keyof typeof RECIPES) => {
    const recipe = RECIPES[recipeId];
    kitchenAudio.unlockSync();
    setBusyId(`sell_${recipeId}`);
    const res = await sellCookedDish(recipe.cookedItemId, 1, recipe.takeoutPrice);
    setBusyId(null);

    if (res.ok) {
      kitchenAudio.playCoin();
      pushToast(
        t.soldTakeoutToast(t.recipes[recipeId].name, recipe.takeoutPrice),
        'success',
      );
    } else {
      kitchenAudio.playError();
    }
  };

  const waitingOrders = orders.filter(
    (o) => o.status === 'waiting' || o.status === 'delivering',
  );

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      icon="🔔"
      title={t.servicePassTitle}
      subtitle={t.servicePassSubtitle}
    >
      <div className="space-y-4">
        {/* Service Status Bar */}
        <div className="ui-surface flex flex-wrap items-center justify-between gap-2 rounded-2xl p-3">
          <div>
            <p className="text-xs font-extrabold">
              {restaurantOpen ? `🟢 ${t.restaurantOpenBadge}` : `🔴 ${t.restaurantClosedBadge}`}
            </p>
            <p className="text-[11px] ui-muted">
              {t.servedStatsLabel(servedOrdersCount, serviceStreak)}
            </p>
          </div>
          <button
            type="button"
            disabled={busyId === 'toggle'}
            onClick={() => void handleToggleOpen()}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold text-white shadow-sm transition active:scale-95 disabled:opacity-50 ${
              restaurantOpen ? 'bg-amber-600' : 'bg-emerald-600'
            }`}
          >
            {restaurantOpen ? (
              <>
                <PauseCircle className="h-4 w-4" aria-hidden="true" />
                <span>{t.closeRestaurantBtn}</span>
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4" aria-hidden="true" />
                <span>{t.openRestaurantBtn}</span>
              </>
            )}
          </button>
        </div>

        {/* Waiting Orders Dispatch List */}
        <section className="space-y-2">
          <h2 className="text-xs font-extrabold uppercase tracking-wider ui-muted">
            {t.waitingOrdersHeading}
          </h2>
          {waitingOrders.length === 0 ? (
            <p className="ui-surface rounded-xl px-3 py-3 text-xs ui-muted">
              {restaurantOpen ? t.noActiveOrdersHint : t.restaurantClosedHint}
            </p>
          ) : (
            <div className="space-y-2">
              {waitingOrders.map((order) => {
                const recipe = RECIPES[order.recipeId];
                const tableNum = RESTAURANT_TABLES[order.tableId].tableNumber;
                const cookedQty = inventory[recipe.cookedItemId] ?? 0;
                const patience = evaluateOrderPatience(order.createdAt, order.expiresAt, nowMs);
                const isDelivering = order.status === 'delivering';

                return (
                  <div
                    key={order.id}
                    className="ui-surface flex items-center justify-between gap-3 rounded-2xl p-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-800 dark:text-amber-200">
                          {t.tableLabel(tableNum)}
                        </span>
                        <span className="text-base">{recipe.icon}</span>
                        <span className="truncate text-xs font-extrabold">
                          {t.recipes[recipe.id].name}
                        </span>
                        <span className="text-[10px] ui-muted">
                          ({t.difficultyLabels[order.difficulty]})
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] ui-muted">
                        {order.customerName} ·{' '}
                        {isDelivering
                          ? `🤵 ${t.waiterDeliveringShort}`
                          : `⏱ ${formatRemainingTime(patience.remainingMs)}`}
                      </p>
                    </div>

                    {isDelivering ? (
                      <span className="rounded-xl bg-sky-500/15 px-3 py-1.5 text-xs font-extrabold text-sky-700 dark:text-sky-200">
                        +🪙 {order.rewardCoins + order.tipCoins}
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={cookedQty < 1 || patience.isExpired || busyId === order.id}
                        onClick={() => void handleDispatchOrder(order.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white shadow-sm transition active:scale-95 disabled:opacity-40"
                      >
                        <Send className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{cookedQty > 0 ? t.sendToWaiterBtn : t.needCookedBtn}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Ready Cooked Dishes & Takeout Sale */}
        <section className="space-y-2">
          <h2 className="text-xs font-extrabold uppercase tracking-wider ui-muted">
            {t.readyDishesHeading}
          </h2>
          <div className="grid grid-cols-3 gap-2.5">
            {RECIPE_LIST.map((recipe) => {
              const qty = inventory[recipe.cookedItemId] ?? 0;
              return (
                <div
                  key={recipe.id}
                  className="ui-surface flex flex-col justify-between gap-2 rounded-2xl p-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl" aria-hidden="true">
                      {recipe.icon}
                    </span>
                    <span
                      className={`rounded-lg px-2 py-0.5 text-[11px] font-extrabold ${
                        qty > 0
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-200'
                          : 'ui-subtle ui-muted'
                      }`}
                    >
                      {t.readyCountLabel(qty)}
                    </span>
                  </div>
                  <p className="text-xs font-extrabold leading-tight">
                    {t.recipes[recipe.id].name}
                  </p>
                  <button
                    type="button"
                    disabled={qty < 1 || busyId === `sell_${recipe.id}`}
                    onClick={() => void handleSellTakeout(recipe.id)}
                    className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-[#e07a5f] py-1.5 text-[11px] font-extrabold text-white transition active:scale-95 disabled:opacity-40"
                  >
                    <Package className="h-3 w-3" aria-hidden="true" />
                    <span>{t.sellTakeoutBtn(recipe.takeoutPrice)}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </ModalDialog>
  );
}
