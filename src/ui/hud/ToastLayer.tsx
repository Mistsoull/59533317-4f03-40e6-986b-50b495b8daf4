import { kitchenAudio } from '../../domain/audio';
import { getTranslations } from '../../i18n/translations';
import { useGameStore } from '../../store/useGameStore';
import { useLanguageStore } from '../../store/useLanguageStore';

export function ToastLayer() {
  const toasts = useGameStore((s) => s.toasts);
  const setActiveOverlay = useGameStore((s) => s.setActiveOverlay);
  const dismissToast = useGameStore((s) => s.dismissToast);
  const lang = useLanguageStore((s) => s.lang);
  const t = getTranslations(lang);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-3 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-1.5 safe-bottom"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const toneCls =
          toast.tone === 'order'
            ? 'border-amber-300/80 bg-amber-600 text-white ring-2 ring-amber-300/40'
            : toast.tone === 'success'
              ? 'border-emerald-500/40 bg-emerald-600 text-white'
              : toast.tone === 'warn'
                ? 'border-rose-500/40 bg-rose-600 text-white'
                : 'ui-card';

        if (toast.actionOverlay) {
          return (
            <button
              key={toast.id}
              type="button"
              onClick={() => {
                kitchenAudio.unlockSync();
                kitchenAudio.playTap();
                setActiveOverlay(toast.actionOverlay!);
                dismissToast(toast.id);
              }}
              className={`pointer-events-auto inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-xs font-extrabold shadow-xl backdrop-blur-md transition active:scale-95 ${toneCls}`}
            >
              <span>{toast.message}</span>
              <span className="rounded-lg bg-white/25 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide">
                {t.tapToOpenOrdersHint}
              </span>
            </button>
          );
        }

        return (
          <div
            key={toast.id}
            className={`rounded-2xl border px-4 py-2 text-xs font-bold shadow-xl backdrop-blur-md ${toneCls}`}
          >
            {toast.message}
          </div>
        );
      })}
    </div>
  );
}
