import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { AnimState } from '../../services/supabase/types';
import {
  ASSET_MANIFEST,
  DRACO_DECODER_PATH,
  resolveModelUrl,
  type AssetId,
} from './assetManifest';

interface ModelErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface ModelErrorBoundaryState {
  hasError: boolean;
}

class ModelErrorBoundary extends Component<ModelErrorBoundaryProps, ModelErrorBoundaryState> {
  public state: ModelErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): ModelErrorBoundaryState {
    return { hasError: true };
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

interface GlbInstanceProps {
  url: string;
  skinned: boolean;
  scale: number;
  animRef?: MutableRefObject<AnimState>;
}

function GlbInstance({ url, skinned, scale, animRef }: GlbInstanceProps) {
  // Load Draco-compressed GLB via self-hosted public/draco/ decoder
  const gltf = useGLTF(url, DRACO_DECODER_PATH);
  const groupRef = useRef<THREE.Group>(null);
  const activeAnimRef = useRef<AnimState | null>(null);

  // Skinned characters MUST be cloned via SkeletonUtils.clone
  const clonedScene = useMemo(() => {
    const instance = skinned ? cloneSkinned(gltf.scene) : gltf.scene.clone(true);
    instance.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    return instance;
  }, [gltf.scene, skinned]);

  const { actions } = useAnimations(gltf.animations, groupRef);

  useEffect(() => {
    if (!animRef) return;
    const initial = animRef.current;
    const action = actions[initial] ?? actions.Idle ?? Object.values(actions)[0];
    if (action) {
      action.reset().fadeIn(0.15).play();
      activeAnimRef.current = initial;
    }
    return () => {
      Object.values(actions).forEach((a) => a?.stop());
    };
  }, [actions, animRef]);

  // Switch Idle / Walk / Interact clips cleanly in useFrame without React state updates
  useFrame(() => {
    if (!animRef) return;
    const next = animRef.current;
    if (next === activeAnimRef.current) return;

    const prevAction = activeAnimRef.current ? actions[activeAnimRef.current] : undefined;
    const nextAction = actions[next] ?? actions.Idle;

    if (nextAction && nextAction !== prevAction) {
      prevAction?.fadeOut(0.14);
      nextAction.reset().fadeIn(0.14).play();
    }
    activeAnimRef.current = next;
  });

  return (
    <group ref={groupRef} scale={scale}>
      <primitive object={clonedScene} />
    </group>
  );
}

interface ModelSlotProps {
  assetId: AssetId;
  placeholder: ReactNode;
  animRef?: MutableRefObject<AnimState>;
}

/**
 * Abstraction layer decoupling 3D gameplay from placeholder vs. Draco .glb models.
 * Automatically falls back to the placeholder if a GLB is missing or loading.
 */
export function ModelSlot({ assetId, placeholder, animRef }: ModelSlotProps) {
  const entry = ASSET_MANIFEST[assetId];
  if (entry.mode === 'placeholder') {
    return <>{placeholder}</>;
  }

  const url = resolveModelUrl(entry.glbFile);

  return (
    <ModelErrorBoundary fallback={placeholder}>
      <Suspense fallback={placeholder}>
        <GlbInstance
          url={url}
          skinned={entry.skinned}
          scale={entry.scale}
          animRef={animRef}
        />
      </Suspense>
    </ModelErrorBoundary>
  );
}
