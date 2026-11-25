import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { playerMotionStore } from '../store/playerMotionStore';

export function TargetMarker() {
  const ringRef = useRef<THREE.Mesh>(null);
  const lastIdRef = useRef(0);
  const ageRef = useRef(99);

  useFrame((_, delta) => {
    const mesh = ringRef.current;
    if (!mesh) return;

    const marker = playerMotionStore.local.targetMarker;
    if (!marker) {
      mesh.visible = false;
      return;
    }

    if (marker.id !== lastIdRef.current) {
      lastIdRef.current = marker.id;
      ageRef.current = 0;
      mesh.position.set(marker.x, 0.025, marker.z);
    }

    ageRef.current += Math.min(delta, 0.05);
    const duration = 0.65;
    if (ageRef.current >= duration) {
      mesh.visible = false;
      return;
    }

    const t = ageRef.current / duration;
    mesh.visible = true;
    const scale = 0.55 + t * 0.65;
    mesh.scale.set(scale, scale, 1);
    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.opacity = (1 - t) * 0.85;
  });

  return (
    <mesh ref={ringRef} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.18, 0.28, 24]} />
      <meshBasicMaterial color="#f2cc8f" transparent opacity={0.85} depthWrite={false} />
    </mesh>
  );
}
