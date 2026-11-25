import { useGameStore } from '../../store/useGameStore';

export function ToastLayer() {
  const toasts = useGameStore((s) => s.toasts);
  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-3 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-1.5 safe-bottom"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const toneCls =
          toast.tone === 'success'
            ? 'border-emerald-400/40 bg-emerald-950/90 text-emerald-100'
            : toast.tone === 'warn'
              ? 'border-rose-400/40 bg-rose-950/90 text-rose-100'
              : 'border-amber-300/30 bg-stone-950/90 text-amber-50';
        return (
          <div
            key={toast.id}
            className={`rounded-2xl border px-4 py-2 text-xs font-semibold shadow-xl backdrop-blur-md ${toneCls}`}
          >
            {toast.message}
          </div>
        );
      })}
    </div>
  );
}
