export type AssetId =
  | 'char_cat'
  | 'char_dog'
  | 'char_bubu'
  | 'char_dudu'
  | 'station_fridge'
  | 'station_cutting_board'
  | 'station_stove'
  | 'food_domates'
  | 'food_biber'
  | 'food_yumurta'
  | 'food_mantar'
  | 'food_makarna'
  | 'food_krema'
  | 'food_cilek'
  | 'food_un'
  | 'food_sut'
  | 'market_produce'
  | 'market_dairy'
  | 'market_pantry'
  | 'waiter'
  | 'cust_fox'
  | 'cust_bunny'
  | 'cust_bear'
  | 'restaurant_table'
  | 'dish_menemen'
  | 'dish_mantarli_makarna'
  | 'dish_pankek';

export interface AssetManifestEntry {
  id: AssetId;
  mode: 'placeholder' | 'glb';
  glbFile: string;
  skinned: boolean;
  scale: number;
  clips?: readonly ['Idle', 'Walk', 'Interact'];
}

export const DRACO_DECODER_PATH = `${import.meta.env.BASE_URL}draco/`;

export function resolveModelUrl(glbFile: string): string {
  return `${import.meta.env.BASE_URL}models/${glbFile}`;
}

export const ASSET_MANIFEST: Record<AssetId, AssetManifestEntry> = {
  char_cat: { id: 'char_cat', mode: 'glb', glbFile: 'char_cat.glb', skinned: true, scale: 1, clips: ['Idle', 'Walk', 'Interact'] },
  char_dog: { id: 'char_dog', mode: 'glb', glbFile: 'char_dog.glb', skinned: true, scale: 1, clips: ['Idle', 'Walk', 'Interact'] },
  char_bubu: { id: 'char_bubu', mode: 'glb', glbFile: 'char_bubu.glb', skinned: true, scale: 1, clips: ['Idle', 'Walk', 'Interact'] },
  char_dudu: { id: 'char_dudu', mode: 'glb', glbFile: 'char_dudu.glb', skinned: true, scale: 1, clips: ['Idle', 'Walk', 'Interact'] },

  station_fridge: { id: 'station_fridge', mode: 'glb', glbFile: 'station_fridge.glb', skinned: false, scale: 1 },
  station_cutting_board: { id: 'station_cutting_board', mode: 'glb', glbFile: 'station_cutting_board.glb', skinned: false, scale: 1 },
  station_stove: { id: 'station_stove', mode: 'glb', glbFile: 'station_stove.glb', skinned: false, scale: 1 },

  food_domates: { id: 'food_domates', mode: 'glb', glbFile: 'food_domates.glb', skinned: false, scale: 1 },
  food_biber: { id: 'food_biber', mode: 'glb', glbFile: 'food_biber.glb', skinned: false, scale: 1 },
  food_yumurta: { id: 'food_yumurta', mode: 'glb', glbFile: 'food_yumurta.glb', skinned: false, scale: 1 },
  food_mantar: { id: 'food_mantar', mode: 'glb', glbFile: 'food_mantar.glb', skinned: false, scale: 1 },
  food_makarna: { id: 'food_makarna', mode: 'glb', glbFile: 'food_makarna.glb', skinned: false, scale: 1 },
  food_krema: { id: 'food_krema', mode: 'glb', glbFile: 'food_krema.glb', skinned: false, scale: 1 },
  food_cilek: { id: 'food_cilek', mode: 'glb', glbFile: 'food_cilek.glb', skinned: false, scale: 1 },
  food_un: { id: 'food_un', mode: 'glb', glbFile: 'food_un.glb', skinned: false, scale: 1 },
  food_sut: { id: 'food_sut', mode: 'glb', glbFile: 'food_sut.glb', skinned: false, scale: 1 },

  market_produce: { id: 'market_produce', mode: 'glb', glbFile: 'market_produce.glb', skinned: false, scale: 1 },
  market_dairy: { id: 'market_dairy', mode: 'glb', glbFile: 'market_dairy.glb', skinned: false, scale: 1 },
  market_pantry: { id: 'market_pantry', mode: 'glb', glbFile: 'market_pantry.glb', skinned: false, scale: 1 },

  waiter: { id: 'waiter', mode: 'glb', glbFile: 'waiter.glb', skinned: true, scale: 1, clips: ['Idle', 'Walk', 'Interact'] },
  cust_fox: { id: 'cust_fox', mode: 'glb', glbFile: 'cust_fox.glb', skinned: true, scale: 0.96, clips: ['Idle', 'Walk', 'Interact'] },
  cust_bunny: { id: 'cust_bunny', mode: 'glb', glbFile: 'cust_bunny.glb', skinned: true, scale: 0.96, clips: ['Idle', 'Walk', 'Interact'] },
  cust_bear: { id: 'cust_bear', mode: 'glb', glbFile: 'cust_bear.glb', skinned: true, scale: 0.98, clips: ['Idle', 'Walk', 'Interact'] },
  restaurant_table: { id: 'restaurant_table', mode: 'glb', glbFile: 'restaurant_table.glb', skinned: false, scale: 1 },
  dish_menemen: { id: 'dish_menemen', mode: 'glb', glbFile: 'dish_menemen.glb', skinned: false, scale: 1 },
  dish_mantarli_makarna: { id: 'dish_mantarli_makarna', mode: 'glb', glbFile: 'dish_mantarli_makarna.glb', skinned: false, scale: 1 },
  dish_pankek: { id: 'dish_pankek', mode: 'glb', glbFile: 'dish_pankek.glb', skinned: false, scale: 1 },
};
