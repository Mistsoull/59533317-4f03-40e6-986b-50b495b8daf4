export type IngredientStage = 'raw' | 'prepped' | 'cooked';

export interface IngredientDef {
  id: string;
  name: string;
  stage: IngredientStage;
  price: number; // Buy price for raw items; takeout sell price for cooked dishes; 0 for prepped
  icon: string;
  color: string;
  prepTargetId?: string;
  rawSourceId?: string;
  recipeId?: 'menemen' | 'mantarli_makarna' | 'pankek';
}

export const INGREDIENTS: Record<string, IngredientDef> = {
  // Ham malzemeler (Market'ten alınır, Buzdolabında saklanır)
  domates: {
    id: 'domates',
    name: 'Domates',
    stage: 'raw',
    price: 12,
    icon: '🍅',
    color: '#e63946',
    prepTargetId: 'domates_dogranmis',
  },
  biber: {
    id: 'biber',
    name: 'Yeşil Biber',
    stage: 'raw',
    price: 10,
    icon: '🫑',
    color: '#40916c',
    prepTargetId: 'biber_dogranmis',
  },
  yumurta: {
    id: 'yumurta',
    name: 'Yumurta',
    stage: 'raw',
    price: 14,
    icon: '🥚',
    color: '#f4e4c1',
  },
  mantar: {
    id: 'mantar',
    name: 'Kültür Mantarı',
    stage: 'raw',
    price: 18,
    icon: '🍄',
    color: '#b08968',
    prepTargetId: 'mantar_dilim',
  },
  makarna: {
    id: 'makarna',
    name: 'Makarna',
    stage: 'raw',
    price: 15,
    icon: '🍝',
    color: '#e9c46a',
  },
  krema: {
    id: 'krema',
    name: 'Sıvı Krema',
    stage: 'raw',
    price: 20,
    icon: '🥛',
    color: '#f8f9fa',
  },
  cilek: {
    id: 'cilek',
    name: 'Taze Çilek',
    stage: 'raw',
    price: 16,
    icon: '🍓',
    color: '#d62828',
    prepTargetId: 'cilek_dilim',
  },
  un: {
    id: 'un',
    name: 'Buğday Unu',
    stage: 'raw',
    price: 10,
    icon: '🌾',
    color: '#ede0d4',
  },
  sut: {
    id: 'sut',
    name: 'Günlük Süt',
    stage: 'raw',
    price: 12,
    icon: '🧈',
    color: '#e0fbfc',
  },

  // Kesme Tahtasında hazırlanmış malzemeler
  domates_dogranmis: {
    id: 'domates_dogranmis',
    name: 'Doğranmış Domates',
    stage: 'prepped',
    price: 0,
    icon: '🔪🍅',
    color: '#d90429',
    rawSourceId: 'domates',
  },
  biber_dogranmis: {
    id: 'biber_dogranmis',
    name: 'Doğranmış Biber',
    stage: 'prepped',
    price: 0,
    icon: '🔪🫑',
    color: '#2d6a4f',
    rawSourceId: 'biber',
  },
  mantar_dilim: {
    id: 'mantar_dilim',
    name: 'Dilimlenmiş Mantar',
    stage: 'prepped',
    price: 0,
    icon: '🔪🍄',
    color: '#9c6644',
    rawSourceId: 'mantar',
  },
  cilek_dilim: {
    id: 'cilek_dilim',
    name: 'Dilimlenmiş Çilek',
    stage: 'prepped',
    price: 0,
    icon: '🔪🍓',
    color: '#c1121f',
    rawSourceId: 'cilek',
  },

  // Ocakta pişirilmiş, garsona veya paket satışa hazır tabaklar
  dish_menemen: {
    id: 'dish_menemen',
    name: 'Hazır Menemen',
    stage: 'cooked',
    price: 38,
    icon: '🍳',
    color: '#e07a5f',
    recipeId: 'menemen',
  },
  dish_mantarli_makarna: {
    id: 'dish_mantarli_makarna',
    name: 'Hazır Mantarlı Makarna',
    stage: 'cooked',
    price: 70,
    icon: '🍝',
    color: '#d4a373',
    recipeId: 'mantarli_makarna',
  },
  dish_pankek: {
    id: 'dish_pankek',
    name: 'Hazır Çilekli Pankek',
    stage: 'cooked',
    price: 55,
    icon: '🥞',
    color: '#f2cc8f',
    recipeId: 'pankek',
  },
};

export const MARKET_ITEMS: readonly IngredientDef[] = Object.values(INGREDIENTS).filter(
  (item) => item.stage === 'raw',
);

export const PREPPABLE_ITEMS: readonly IngredientDef[] = Object.values(INGREDIENTS).filter(
  (item) => item.stage === 'raw' && Boolean(item.prepTargetId),
);

export const PREPPED_ITEMS: readonly IngredientDef[] = Object.values(INGREDIENTS).filter(
  (item) => item.stage === 'prepped',
);

export const COOKED_ITEMS: readonly IngredientDef[] = Object.values(INGREDIENTS).filter(
  (item) => item.stage === 'cooked',
);
