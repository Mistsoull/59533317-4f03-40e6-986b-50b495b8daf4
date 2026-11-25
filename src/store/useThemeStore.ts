import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'color-scheme';

function readInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // Ignore storage errors
  }
  return 'light';
}

function applyThemeToDocument(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (meta) {
    meta.content = theme;
  }
  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (themeColor) {
    themeColor.content = theme === 'dark' ? '#1e1b18' : '#f7efe3';
  }
}

interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const initialTheme = readInitialTheme();
applyThemeToDocument(initialTheme);

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initialTheme,

  setTheme: (theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore storage errors
    }
    applyThemeToDocument(theme);
    set({ theme });
  },

  toggleTheme: () => {
    const next: ThemeMode = get().theme === 'light' ? 'dark' : 'light';
    get().setTheme(next);
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY && (event.newValue === 'light' || event.newValue === 'dark')) {
      applyThemeToDocument(event.newValue);
      useThemeStore.setState({ theme: event.newValue });
    }
  });
}
