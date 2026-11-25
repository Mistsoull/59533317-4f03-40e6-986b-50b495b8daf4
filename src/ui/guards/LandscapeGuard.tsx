import { useEffect, useState } from 'react';
import { RotateCw } from 'lucide-react';

function isPortraitViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerHeight > window.innerWidth;
}

/**
 * Enforces Landscape orientation across iPhone 17 Pro Safari PWA & Samsung S23 Chrome PWA.
 * Attempts ScreenOrientation.lock('landscape') on Android Chrome where supported,
 * and shows a blocking rotate prompt whenever the device is held vertically.
 */
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
        void orientationApi.lock('landscape').catch(() => {
          // Silently ignored on iOS Safari and desktop browsers
        });
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
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5 bg-[#1e1b18] px-8 text-center text-amber-50 safe-x safe-top safe-bottom"
      role="status"
      aria-live="polite"
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-amber-300/25 bg-amber-500/15 text-amber-300 shadow-xl">
        <RotateCw className="h-10 w-10 animate-spin" style={{ animationDuration: '4s' }} aria-hidden="true" />
      </div>
      <div className="space-y-2 max-w-xs">
        <h1 className="text-xl font-bold tracking-tight">Telefonunu Yatay Çevir</h1>
        <p className="text-sm text-stone-300">
          Bizim Mutfak yalnızca yatay (landscape) modda oynanır. Cihazını yan çevirdiğinde mutfak otomatik açılacak.
        </p>
      </div>
    </div>
  );
}
