import { create } from 'zustand';

const IRL_STORAGE_KEY = 'cozy_kitchen_show_irl_recipes_v1';

function readInitialShowIrl(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const saved = localStorage.getItem(IRL_STORAGE_KEY);
    if (saved === '0') return false;
    if (saved === '1') return true;
  } catch {
    // Ignore storage errors
  }
  return true;
}

interface SettingsState {
  showRealLifeRecipes: boolean;
  setShowRealLifeRecipes: (show: boolean) => void;
  toggleRealLifeRecipes: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  showRealLifeRecipes: readInitialShowIrl(),

  setShowRealLifeRecipes: (show) => {
    try {
      localStorage.setItem(IRL_STORAGE_KEY, show ? '1' : '0');
    } catch {
      // Ignore storage errors
    }
    set({ showRealLifeRecipes: show });
  },

  toggleRealLifeRecipes: () => {
    get().setShowRealLifeRecipes(!get().showRealLifeRecipes);
  },
}));
