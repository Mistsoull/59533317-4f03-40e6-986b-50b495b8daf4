import { create } from 'zustand';
import { PROFILES, type ProfileId } from '../config/profiles';
import type { RecipeId } from '../config/recipes';
import type { RoomId, StationId } from '../config/kitchenLayout';
import type { MarketStallId } from '../config/marketLayout';
import type {
  HomeSnapshot,
  ProfileRow,
  RecipeProgressRow,
  RestaurantOrderRow,
  StationStateRow,
} from '../services/supabase/types';

export type ActiveOverlay =
  | null
  | 'fridge'
  | 'market_stall'
  | 'recipe_book'
  | 'cutting_board'
  | 'stove'
  | 'service_pass'
  | 'settings';

export interface ToastItem {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'warn' | 'order';
  actionOverlay?: ActiveOverlay;
}

let toastIdCounter = 0;

function createInitialSnapshot(): HomeSnapshot {
  return {
    coins: 120,
    restaurantOpen: false,
    servedOrdersCount: 0,
    serviceStreak: 0,
    lastOrderSpawnedAt: null,
    profiles: {
      p1: {
        id: 'p1',
        displayName: PROFILES.p1.defaultName,
        avatarColor: PROFILES.p1.avatarColor,
        characterId: PROFILES.p1.defaultCharacter,
      },
      p2: {
        id: 'p2',
        displayName: PROFILES.p2.defaultName,
        avatarColor: PROFILES.p2.avatarColor,
        characterId: PROFILES.p2.defaultCharacter,
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
    orders: [],
  };
}

interface GameState {
  loaded: boolean;
  currentRoom: RoomId;
  activeMarketStall: MarketStallId | 'all';
  coins: number;
  restaurantOpen: boolean;
  servedOrdersCount: number;
  serviceStreak: number;
  lastOrderSpawnedAt: string | null;
  clockOffsetMs: number;
  profiles: Record<ProfileId, ProfileRow>;
  inventory: Record<string, number>;
  stations: Record<StationId, StationStateRow>;
  recipes: Record<RecipeId, RecipeProgressRow>;
  orders: RestaurantOrderRow[];
  activeOverlay: ActiveOverlay;
  heldLockStation: StationId | null;
  toasts: ToastItem[];
  setCurrentRoom: (room: RoomId) => void;
  openMarketStall: (stall: MarketStallId | 'all') => void;
  applySnapshot: (snapshot: HomeSnapshot) => void;
  setCoins: (coins: number) => void;
  patchRestaurantMeta: (patch: {
    restaurantOpen?: boolean;
    servedOrdersCount?: number;
    serviceStreak?: number;
    lastOrderSpawnedAt?: string | null;
  }) => void;
  setClockOffsetMs: (offsetMs: number) => void;
  patchProfile: (profile: ProfileRow) => void;
  patchInventoryItem: (itemId: string, quantity: number) => void;
  patchStation: (station: StationStateRow) => void;
  patchRecipe: (recipe: RecipeProgressRow) => void;
  upsertOrder: (order: RestaurantOrderRow) => void;
  setOrders: (orders: RestaurantOrderRow[]) => void;
  setActiveOverlay: (overlay: ActiveOverlay) => void;
  setHeldLockStation: (station: StationId | null) => void;
  pushToast: (
    message: string,
    tone?: ToastItem['tone'],
    actionOverlay?: ActiveOverlay,
  ) => void;
  dismissToast: (id: number) => void;
}

const initial = createInitialSnapshot();

export const useGameStore = create<GameState>((set) => ({
  loaded: false,
  currentRoom: 'kitchen',
  activeMarketStall: 'all',
  ...initial,
  clockOffsetMs: 0,
  activeOverlay: null,
  heldLockStation: null,
  toasts: [],

  setCurrentRoom: (currentRoom) => set({ currentRoom }),

  openMarketStall: (stall) =>
    set({
      activeMarketStall: stall,
      activeOverlay: 'market_stall',
    }),

  applySnapshot: (snapshot) =>
    set({
      loaded: true,
      coins: snapshot.coins,
      restaurantOpen: snapshot.restaurantOpen,
      servedOrdersCount: snapshot.servedOrdersCount,
      serviceStreak: snapshot.serviceStreak,
      lastOrderSpawnedAt: snapshot.lastOrderSpawnedAt,
      profiles: snapshot.profiles,
      inventory: snapshot.inventory,
      stations: snapshot.stations,
      recipes: snapshot.recipes,
      orders: snapshot.orders,
    }),

  setCoins: (coins) => set({ coins }),

  patchRestaurantMeta: (patch) =>
    set((state) => ({
      restaurantOpen: patch.restaurantOpen ?? state.restaurantOpen,
      servedOrdersCount: patch.servedOrdersCount ?? state.servedOrdersCount,
      serviceStreak: patch.serviceStreak ?? state.serviceStreak,
      lastOrderSpawnedAt:
        patch.lastOrderSpawnedAt !== undefined
          ? patch.lastOrderSpawnedAt
          : state.lastOrderSpawnedAt,
    })),

  setClockOffsetMs: (clockOffsetMs) => set({ clockOffsetMs }),

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

  upsertOrder: (order) =>
    set((state) => {
      if (order.status === 'served' || order.status === 'expired') {
        if (!state.orders.some((o) => o.id === order.id)) return state;
        return { orders: state.orders.filter((o) => o.id !== order.id) };
      }
      // Enforce at most 1 active order per tableId and unique order.id
      const withoutDupes = state.orders.filter(
        (o) => o.id !== order.id && o.tableId !== order.tableId,
      );
      const next = [...withoutDupes, order].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      return { orders: next };
    }),

  setOrders: (orders) =>
    set(() => {
      const byTable = new Map<string, RestaurantOrderRow>();
      for (const o of orders) {
        if (o.status !== 'waiting' && o.status !== 'delivering') continue;
        byTable.set(o.tableId, o);
      }
      const deduped = Array.from(byTable.values()).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      return { orders: deduped };
    }),

  setActiveOverlay: (activeOverlay) => set({ activeOverlay }),

  setHeldLockStation: (heldLockStation) => set({ heldLockStation }),

  pushToast: (message, tone = 'info', actionOverlay) => {
    toastIdCounter += 1;
    const id = toastIdCounter;
    set((state) => ({
      toasts: [...state.toasts.slice(-2), { id, message, tone, actionOverlay }],
    }));
    const durationMs = tone === 'order' ? 5200 : 3200;
    window.setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, durationMs);
  },

  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
