import { MARKET_ITEMS, PREPPED_ITEMS } from '../../config/ingredients';
import { getTranslations } from '../../i18n/translations';
import { useGameStore } from '../../store/useGameStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import { ModalDialog } from '../common/ModalDialog';

interface FridgeModalProps {
  open: boolean;
  onClose: () => void;
}

export function FridgeModal({ open, onClose }: FridgeModalProps) {
  const inventory = useGameStore((s) => s.inventory);
  const lang = useLanguageStore((s) => s.lang);
  const t = getTranslations(lang);

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      icon="🧊"
      title={t.fridgeTitle}
      subtitle={t.fridgeSubtitle}
    >
      <div className="grid grid-cols-2 gap-4">
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider ui-muted">
            {t.rawIngredients}
          </h2>
          <div className="space-y-1.5">
            {MARKET_ITEMS.map((item) => {
              const qty = inventory[item.id] ?? 0;
              return (
                <div
                  key={item.id}
                  className="ui-surface flex items-center justify-between rounded-xl px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg" aria-hidden="true">
                      {item.icon}
                    </span>
                    <div>
                      <p className="text-xs font-bold">{t.ingredients[item.id] ?? item.name}</p>
                      {item.prepTargetId && (
                        <p className="text-[10px] text-[#d46548]">{t.chopHint}</p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`rounded-lg px-2 py-0.5 text-xs font-extrabold ${
                      qty > 0
                        ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-200'
                        : 'ui-subtle ui-muted'
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
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider ui-muted">
            {t.preppedIngredients}
          </h2>
          <div className="space-y-1.5">
            {PREPPED_ITEMS.map((item) => {
              const qty = inventory[item.id] ?? 0;
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg" aria-hidden="true">
                      {item.icon}
                    </span>
                    <p className="text-xs font-bold">{t.ingredients[item.id] ?? item.name}</p>
                  </div>
                  <span
                    className={`rounded-lg px-2 py-0.5 text-xs font-extrabold ${
                      qty > 0
                        ? 'bg-emerald-600 text-white'
                        : 'ui-subtle ui-muted'
                    }`}
                  >
                    ×{qty}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 space-y-2">
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs">
              {t.fridgeCoopTip}
            </div>
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs">
              {t.walkToMarketHint}
            </div>
          </div>
        </section>
      </div>
    </ModalDialog>
  );
}
