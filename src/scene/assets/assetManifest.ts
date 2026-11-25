export type AssetId =
  | 'chef_p1'
  | 'chef_p2'
  | 'station_fridge'
  | 'station_cutting_board'
  | 'station_stove';

export interface AssetManifestEntry {
  id: AssetId;
  /** Toggle between procedural placeholder and Draco-compressed .glb */
  mode: 'placeholder' | 'glb';
  /** Relative filename under public/models/ (resolved with BASE_URL) */
  glbFile: string;
  /** Whether the GLB uses a SkinnedMesh requiring SkeletonUtils.clone */
  skinned: boolean;
  /** Uniform scale multiplier (1 unit = 1 meter contract) */
  scale: number;
  /** Required animation clip names for animated assets */
  clips?: readonly ['Idle', 'Walk', 'Interact'];
}

export const DRACO_DECODER_PATH = `${import.meta.env.BASE_URL}draco/`;

export function resolveModelUrl(glbFile: string): string {
  return `${import.meta.env.BASE_URL}models/${glbFile}`;
}

/**
 * Central 3D Asset Registry.
 * Uses Draco-compressed .glb assets from public/models/ with automatic placeholder fallback.
 */
export const ASSET_MANIFEST: Record<AssetId, AssetManifestEntry> = {
  chef_p1: {
    id: 'chef_p1',
    mode: 'glb',
    glbFile: 'chef_p1.glb',
    skinned: true,
    scale: 1,
    clips: ['Idle', 'Walk', 'Interact'],
  },
  chef_p2: {
    id: 'chef_p2',
    mode: 'glb',
    glbFile: 'chef_p2.glb',
    skinned: true,
    scale: 1,
    clips: ['Idle', 'Walk', 'Interact'],
  },
  station_fridge: {
    id: 'station_fridge',
    mode: 'glb',
    glbFile: 'station_fridge.glb',
    skinned: false,
    scale: 1,
  },
  station_cutting_board: {
    id: 'station_cutting_board',
    mode: 'glb',
    glbFile: 'station_cutting_board.glb',
    skinned: false,
    scale: 1,
  },
  station_stove: {
    id: 'station_stove',
    mode: 'glb',
    glbFile: 'station_stove.glb',
    skinned: false,
    scale: 1,
  },
};
