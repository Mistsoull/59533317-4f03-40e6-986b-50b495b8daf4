import { useEffect, useState } from 'react';
import { RotateCw } from 'lucide-react';

function isPortraitViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerHeight > window.innerWidth;
}

export function LandscapeGuard() {
  const [isPortrait, setIsPortrait] = useState(isPortraitViewport);

  useEffect(() => {
    const update = () => setIsPortrait(isPortraitViewport());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);

    const tryLockLandscape = () => {
      const orientationApi = screen.orientation as ScreenOrientation & {
        lock?: (mode: string) => Promise<void>;
      };
      if (orientationApi && typeof orientationApi.lock === 'function') {
        void orientationApi.lock('landscape').catch(() => undefined);
      }
    };

    window.addEventListener('pointerdown', tryLockLandscape, { once: true, passive: true });
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      window.removeEventListener('pointerdown', tryLockLandscape);
    };
  }, []);

  if (!isPortrait) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5 px-8 text-center safe-x safe-top safe-bottom"
      style={{ background: 'var(--bg-app)', color: 'var(--text-main)' }}
      role="status"
      aria-live="polite"
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-amber-500/35 bg-amber-500/15 text-amber-600 shadow-xl">
        <RotateCw
          className="h-10 w-10 animate-spin"
          style={{ animationDuration: '4s' }}
          aria-hidden="true"
        />
      </div>
      <div className="max-w-xs space-y-2">
        <h1 className="text-xl font-extrabold tracking-tight">Telefonunu Yatay Çevir</h1>
        <p className="text-sm ui-muted">
          Bizim Mutfak yalnızca yatay (landscape) modda oynanır. Cihazını yan çevirdiğinde mutfak otomatik açılacak.
        </p>
      </div>
    </div>
  );
}
