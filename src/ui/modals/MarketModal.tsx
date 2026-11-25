import { useState } from 'react';
import { Gift } from 'lucide-react';
import { INGREDIENTS, MARKET_ITEMS } from '../../config/ingredients';
import { MARKET_STALLS, MARKET_STALL_LIST, type MarketStallId } from '../../config/marketLayout';
import { RECIPE_LIST } from '../../config/recipes';
import { kitchenAudio } from '../../domain/audio';
import { needsPantrySupport } from '../../domain/stationRules';
import { getTranslations } from '../../i18n/translations';
import { buyIngredient, claimPantrySupport } from '../../services/supabase/homeRepository';
import { useGameStore } from '../../store/useGameStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import { ModalDialog } from '../common/ModalDialog';

export function MarketModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const coins = useGameStore((s) => s.coins);
  const inventory = useGameStore((s) => s.inventory);
  const activeStall = useGameStore((s) => s.activeMarketStall);
  const openMarketStall = useGameStore((s) => s.openMarketStall);
  const pushToast = useGameStore((s) => s.pushToast);
  const lang = useLanguageStore((s) => s.lang);
  const t = getTranslations(lang);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canClaimSupport = needsPantrySupport(coins, inventory, RECIPE_LIST);

  const currentStallDef = activeStall === 'all' ? null : MARKET_STALLS[activeStall];
  const visibleItems =
    currentStallDef !== null
      ? currentStallDef.itemIds
          .map((id) => INGREDIENTS[id])
          .filter((x): x is NonNullable<typeof x> => Boolean(x))
      : MARKET_ITEMS;

  const handleBuy = async (itemId: string, displayName: string, price: number) => {
    if (busyId) return;
    kitchenAudio.unlockSync();
    if (coins < price) {
      kitchenAudio.playError();
      pushToast(t.notEnoughCoins, 'warn');
      return;
    }

    setBusyId(itemId);
    const res = await buyIngredient(itemId, 1, price);
    setBusyId(null);

    if (res.ok) {
      kitchenAudio.playCoin();
      pushToast(t.boughtToast(displayName), 'success');
    } else {
      kitchenAudio.playError();
      pushToast(t.buyFailedToast, 'warn');
    }
  };

  const handleClaimSupport = async () => {
    setBusyId('support');
    const res = await claimPantrySupport();
    setBusyId(null);
    if (res.ok) {
      kitchenAudio.playSuccess();
      pushToast(t.pantrySupportToast, 'success');
    }
  };

  const tabs: Array<{ id: MarketStallId | 'all'; label: string }> = [
    { id: 'all', label: t.marketAllTab },
    ...MARKET_STALL_LIST.map((st) => ({
      id: st.id,
      label: `${st.icon} ${t.marketStalls[st.id].label}`,
    })),
  ];

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      icon={currentStallDef?.icon ?? '🛒'}
      title={currentStallDef ? t.marketStalls[currentStallDef.id].label : t.marketTitle}
      subtitle={currentStallDef ? t.marketStalls[currentStallDef.id].subtitle : t.marketSubtitle}
      headerRight={
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/15 px-3 py-1.5 text-sm font-extrabold text-amber-700 dark:text-amber-200">
          🪙 {coins}
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        {tabs.map((tab) => {
          const active = activeStall === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                kitchenAudio.playTap();
                openMarketStall(tab.id);
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition active:scale-95 ${
                active
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'ui-subtle hover:brightness-95'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {canClaimSupport && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/35 bg-emerald-500/12 px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Gift className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
            <span>{t.pantrySupportText}</span>
          </div>
          <button
            type="button"
            disabled={busyId !== null}
            onClick={handleClaimSupport}
            className="shrink-0 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-extrabold text-white transition active:scale-95"
          >
            {t.pantrySupportBtn}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {visibleItems.map((item) => {
          const stock = inventory[item.id] ?? 0;
          const affordable = coins >= item.price;
          const label = t.ingredients[item.id] ?? item.name;
          return (
            <div
              key={item.id}
              className="ui-surface flex flex-col justify-between gap-2 rounded-2xl p-3"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-2xl leading-none" aria-hidden="true">
                  {item.icon}
                </span>
                <div>
                  <p className="text-xs font-extrabold">{label}</p>
                  <p className="text-[11px] ui-muted">{t.inFridgeCount(stock)}</p>
                </div>
              </div>

              <button
                type="button"
                disabled={!affordable || busyId === item.id}
                onClick={() => handleBuy(item.id, label, item.price)}
                className="w-full rounded-xl bg-[#e07a5f] px-3 py-2 text-xs font-extrabold text-white shadow-xs transition active:scale-95 disabled:opacity-40"
              >
                {busyId === item.id ? t.buying : t.buyOne(item.price)}
              </button>
            </div>
          );
        })}
      </div>
    </ModalDialog>
  );
}
