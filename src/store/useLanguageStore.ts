import { create } from 'zustand';

export type Language = 'tr' | 'de';

const STORAGE_KEY = 'cozy_kitchen_lang_v1';

function readInitialLanguage(): Language {
  if (typeof window === 'undefined') return 'tr';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'tr' || saved === 'de') return saved;
  } catch {
    // Ignore storage errors
  }
  return 'tr';
}

interface LanguageState {
  lang: Language;
  setLang: (lang: Language) => void;
}

const initialLang = readInitialLanguage();
if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLang;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  lang: initialLang,
  setLang: (lang) => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Ignore storage errors
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
    set({ lang });
  },
}));
