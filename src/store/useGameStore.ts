import { create } from 'zustand';
import { PROFILES, type ProfileId } from '../config/profiles';
import type { RecipeId } from '../config/recipes';
import type { StationId } from '../config/kitchenLayout';
import type {
  HomeSnapshot,
  ProfileRow,
  RecipeProgressRow,
  StationStateRow,
} from '../services/supabase/types';

export type ActiveOverlay =
  | null
  | 'fridge'
  | 'market'
  | 'recipe_book'
  | 'cutting_board'
  | 'stove';

export interface ToastItem {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'warn';
}

let toastIdCounter = 0;

function createInitialSnapshot(): HomeSnapshot {
  return {
    coins: 120,
    profiles: {
      p1: {
        id: 'p1',
        displayName: PROFILES.p1.defaultName,
        avatarColor: PROFILES.p1.avatarColor,
      },
      p2: {
        id: 'p2',
        displayName: PROFILES.p2.defaultName,
        avatarColor: PROFILES.p2.avatarColor,
      },
    },
    inventory: {
      domates: 2,
      biber: 2,
      yumurta: 3,
      mantar: 1,
      makarna: 1,
      krema: 1,
      cilek: 1,
      un: 1,
      sut: 1,
    },
    stations: {
      fridge: {
        id: 'fridge',
        status: 'idle',
        activeRecipeId: null,
        stationPayload: {},
        lockedBy: null,
        lockExpiresAt: null,
      },
      cutting_board: {
        id: 'cutting_board',
        status: 'idle',
        activeRecipeId: null,
        stationPayload: {},
        lockedBy: null,
        lockExpiresAt: null,
      },
      stove: {
        id: 'stove',
        status: 'idle',
        activeRecipeId: null,
        stationPayload: {},
        lockedBy: null,
        lockExpiresAt: null,
      },
    },
    recipes: {
      menemen: {
        recipeId: 'menemen',
        inGameCookCount: 0,
        irlCookedCount: 0,
        irlConfirmedP1: false,
        irlConfirmedP2: false,
        irlLastCookedAt: null,
        irlNote: null,
      },
      mantarli_makarna: {
        recipeId: 'mantarli_makarna',
        inGameCookCount: 0,
        irlCookedCount: 0,
        irlConfirmedP1: false,
        irlConfirmedP2: false,
        irlLastCookedAt: null,
        irlNote: null,
      },
      pankek: {
        recipeId: 'pankek',
        inGameCookCount: 0,
        irlCookedCount: 0,
        irlConfirmedP1: false,
        irlConfirmedP2: false,
        irlLastCookedAt: null,
        irlNote: null,
      },
    },
  };
}

interface GameState {
  loaded: boolean;
  coins: number;
  profiles: Record<ProfileId, ProfileRow>;
  inventory: Record<string, number>;
  stations: Record<StationId, StationStateRow>;
  recipes: Record<RecipeId, RecipeProgressRow>;
  activeOverlay: ActiveOverlay;
  heldLockStation: StationId | null;
  toasts: ToastItem[];
  applySnapshot: (snapshot: HomeSnapshot) => void;
  setCoins: (coins: number) => void;
  patchProfile: (profile: ProfileRow) => void;
  patchInventoryItem: (itemId: string, quantity: number) => void;
  patchStation: (station: StationStateRow) => void;
  patchRecipe: (recipe: RecipeProgressRow) => void;
  setActiveOverlay: (overlay: ActiveOverlay) => void;
  setHeldLockStation: (station: StationId | null) => void;
  pushToast: (message: string, tone?: ToastItem['tone']) => void;
  dismissToast: (id: number) => void;
}

const initial = createInitialSnapshot();

export const useGameStore = create<GameState>((set) => ({
  loaded: false,
  ...initial,
  activeOverlay: null,
  heldLockStation: null,
  toasts: [],

  applySnapshot: (snapshot) =>
    set({
      loaded: true,
      coins: snapshot.coins,
      profiles: snapshot.profiles,
      inventory: snapshot.inventory,
      stations: snapshot.stations,
      recipes: snapshot.recipes,
    }),

  setCoins: (coins) => set({ coins }),

  patchProfile: (profile) =>
    set((state) => ({
      profiles: { ...state.profiles, [profile.id]: profile },
    })),

  patchInventoryItem: (itemId, quantity) =>
    set((state) => ({
      inventory: { ...state.inventory, [itemId]: Math.max(0, quantity) },
    })),

  patchStation: (station) =>
    set((state) => ({
      stations: { ...state.stations, [station.id]: station },
    })),

  patchRecipe: (recipe) =>
    set((state) => ({
      recipes: { ...state.recipes, [recipe.recipeId]: recipe },
    })),

  setActiveOverlay: (activeOverlay) => set({ activeOverlay }),

  setHeldLockStation: (heldLockStation) => set({ heldLockStation }),

  pushToast: (message, tone = 'info') => {
    toastIdCounter += 1;
    const id = toastIdCounter;
    set((state) => ({
      toasts: [...state.toasts.slice(-2), { id, message, tone }],
    }));
    window.setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 3200);
  },

  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
