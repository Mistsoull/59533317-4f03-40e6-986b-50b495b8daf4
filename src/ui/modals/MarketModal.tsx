import { useState } from 'react';
import { Gift } from 'lucide-react';
import { MARKET_ITEMS } from '../../config/ingredients';
import { RECIPE_LIST } from '../../config/recipes';
import { kitchenAudio } from '../../domain/audio';
import { needsPantrySupport } from '../../domain/stationRules';
import { buyIngredient, claimPantrySupport } from '../../services/supabase/homeRepository';
import { useGameStore } from '../../store/useGameStore';
import { ModalDialog } from '../common/ModalDialog';

export function MarketModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const coins = useGameStore((s) => s.coins);
  const inventory = useGameStore((s) => s.inventory);
  const pushToast = useGameStore((s) => s.pushToast);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canClaimSupport = needsPantrySupport(coins, inventory, RECIPE_LIST);

  const handleBuy = async (itemId: string, name: string, price: number) => {
    if (busyId) return;
    kitchenAudio.unlockSync();
    if (coins < price) {
      kitchenAudio.playError();
      pushToast('Yeterli coin yok! Yemek pişirerek coin kazanabilirsin.', 'warn');
      return;
    }

    setBusyId(itemId);
    const res = await buyIngredient(itemId, 1, price);
    setBusyId(null);

    if (res.ok) {
      kitchenAudio.playCoin();
      pushToast(`${name} alındı ve buzdolabına eklendi!`, 'success');
    } else {
      kitchenAudio.playError();
      pushToast('Satın alma tamamlanamadı.', 'warn');
    }
  };

  const handleClaimSupport = async () => {
    setBusyId('support');
    const res = await claimPantrySupport();
    setBusyId(null);
    if (res.ok) {
      kitchenAudio.playSuccess();
      pushToast('+50 Coin Mutfak Destek Paketi eklendi!', 'success');
    }
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      icon="🛒"
      title="Mahalle Marketi"
      subtitle="Alınan malzemeler anında ortak buzdolabına gider."
      headerRight={
        <div className="rounded-xl border border-amber-300/30 bg-amber-500/15 px-3 py-1.5 text-sm font-extrabold text-amber-200">
          🪙 {coins}
        </div>
      }
    >
      {canClaimSupport && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-emerald-400/35 bg-emerald-950/40 px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs text-emerald-100">
            <Gift className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
            <span>Kasa ve dolap neredeyse boş! Ücretsiz destek paketi alabilirsin.</span>
          </div>
          <button
            type="button"
            disabled={busyId !== null}
            onClick={handleClaimSupport}
            className="shrink-0 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-extrabold text-stone-950 transition active:scale-95"
          >
            +50 Coin Al
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2.5">
        {MARKET_ITEMS.map((item) => {
          const stock = inventory[item.id] ?? 0;
          const affordable = coins >= item.price;
          return (
            <div
              key={item.id}
              className="flex flex-col justify-between gap-2 rounded-2xl border border-white/10 bg-stone-900/75 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl leading-none" aria-hidden="true">
                    {item.icon}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-amber-50">{item.name}</p>
                    <p className="text-[11px] text-stone-400">Dolapta: ×{stock}</p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={!affordable || busyId === item.id}
                onClick={() => handleBuy(item.id, item.name, item.price)}
                className="w-full rounded-xl bg-amber-500 px-3 py-2 text-xs font-extrabold text-stone-950 transition active:scale-95 disabled:bg-stone-800 disabled:text-stone-500"
              >
                {busyId === item.id ? 'Alınıyor...' : `+1 Al · 🪙 ${item.price}`}
              </button>
            </div>
          );
        })}
      </div>
    </ModalDialog>
  );
}
