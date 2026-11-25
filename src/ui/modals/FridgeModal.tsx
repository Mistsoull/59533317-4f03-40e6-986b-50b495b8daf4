import { ShoppingBag } from 'lucide-react';
import { MARKET_ITEMS, PREPPED_ITEMS } from '../../config/ingredients';
import { kitchenAudio } from '../../domain/audio';
import { useGameStore } from '../../store/useGameStore';
import { ModalDialog } from '../common/ModalDialog';

export function FridgeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const inventory = useGameStore((s) => s.inventory);
  const setActiveOverlay = useGameStore((s) => s.setActiveOverlay);

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      icon="🧊"
      title="Ortak Buzdolabı"
      subtitle="Evdeki tüm ham ve doğranmış malzemeler anlık senkronize olur."
      headerRight={
        <button
          type="button"
          onClick={() => {
            kitchenAudio.playTap();
            setActiveOverlay('market');
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-stone-950 transition active:scale-95"
        >
          <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
          Markete Git
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-400">
            Ham Malzemeler
          </h2>
          <div className="space-y-1.5">
            {MARKET_ITEMS.map((item) => {
              const qty = inventory[item.id] ?? 0;
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-white/8 bg-stone-900/70 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg" aria-hidden="true">
                      {item.icon}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-stone-100">{item.name}</p>
                      {item.prepTargetId && (
                        <p className="text-[10px] text-amber-300/80">Kesme tahtasında doğranır</p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`rounded-lg px-2 py-0.5 text-xs font-extrabold ${
                      qty > 0
                        ? 'bg-emerald-500/20 text-emerald-200'
                        : 'bg-stone-800 text-stone-500'
                    }`}
                  >
                    ×{qty}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-stone-400">
            Hazırlanmış (Ocak İçin Hazır)
          </h2>
          <div className="space-y-1.5">
            {PREPPED_ITEMS.map((item) => {
              const qty = inventory[item.id] ?? 0;
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-emerald-400/15 bg-emerald-950/25 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg" aria-hidden="true">
                      {item.icon}
                    </span>
                    <p className="text-xs font-semibold text-emerald-50">{item.name}</p>
                  </div>
                  <span
                    className={`rounded-lg px-2 py-0.5 text-xs font-extrabold ${
                      qty > 0
                        ? 'bg-emerald-500/25 text-emerald-200'
                        : 'bg-stone-800 text-stone-500'
                    }`}
                  >
                    ×{qty}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-500/10 p-3 text-xs text-amber-100">
            💡 <strong>İpucu:</strong> Biriniz <strong>Kesme Tahtası</strong>nda doğrama yaparken diğeriniz <strong>Ocak</strong>ta yemeği pişirebilir!
          </div>
        </section>
      </div>
    </ModalDialog>
  );
}
