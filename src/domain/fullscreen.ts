type FullscreenDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenEl = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export function isFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.documentElement as FullscreenEl;
  return Boolean(
    document.fullscreenEnabled ||
      typeof el.requestFullscreen === 'function' ||
      typeof el.webkitRequestFullscreen === 'function',
  );
}

export function isFullscreenActive(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as FullscreenDoc;
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}

export async function enterFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  const el = document.documentElement as FullscreenEl;
  try {
    if (typeof el.requestFullscreen === 'function') {
      await el.requestFullscreen({ navigationUI: 'hide' });
    } else if (typeof el.webkitRequestFullscreen === 'function') {
      await el.webkitRequestFullscreen();
    } else {
      return false;
    }

    // Re-attempt landscape lock once fullscreen activates (works cleanly on Android Chrome)
    const orientationApi = screen.orientation as ScreenOrientation & {
      lock?: (mode: string) => Promise<void>;
    };
    if (orientationApi && typeof orientationApi.lock === 'function') {
      void orientationApi.lock('landscape').catch(() => undefined);
    }
    return true;
  } catch {
    return false;
  }
}

export async function exitFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  const doc = document as FullscreenDoc;
  try {
    if (doc.fullscreenElement && typeof doc.exitFullscreen === 'function') {
      await doc.exitFullscreen();
      return true;
    }
    if (doc.webkitFullscreenElement && typeof doc.webkitExitFullscreen === 'function') {
      await doc.webkitExitFullscreen();
      return true;
    }
  } catch {
    // Ignore errors
  }
  return false;
}

export async function toggleFullscreen(): Promise<boolean> {
  if (isFullscreenActive()) {
    await exitFullscreen();
    return false;
  }
  return enterFullscreen();
}
