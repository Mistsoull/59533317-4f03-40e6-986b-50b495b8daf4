import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import type * as THREE from 'three';
import type { RoomId } from '../config/kitchenLayout';

/**
 * Dual-mode diagonal camera:
 *  - Kitchen: crisp true-45° diagonal isometric OrthographicCamera
 *  - Market: immersive full-screen enclosed interior PerspectiveCamera angled diagonally
 *    so the shop fills 100% of the viewport edge-to-edge with zero outside void.
 */
export function IsometricCamera({ room }: { room: RoomId }) {
  const orthoRef = useRef<THREE.OrthographicCamera>(null);
  const perspRef = useRef<THREE.PerspectiveCamera>(null);
  const { size } = useThree();

  const aspect = size.width / Math.max(1, size.height);
  const kitchenZoom = Math.min(size.width / 9.2, size.height / 6.15);
  // Adapt Market diagonal interior FOV by viewport aspect so Door + all 3 Stalls + Walls fill edge-to-edge
  const marketFov = aspect < 1.35 ? 48 : aspect > 1.95 ? 36 : 42;

  useEffect(() => {
    if (room === 'kitchen' && orthoRef.current) {
      orthoRef.current.lookAt(0, 0.65, -0.2);
      orthoRef.current.updateProjectionMatrix();
    } else if (room === 'market' && perspRef.current) {
      perspRef.current.lookAt(-0.35, 0.92, -1.35);
      perspRef.current.updateProjectionMatrix();
    }
  }, [room, size.width, size.height]);

  if (room === 'market') {
    return (
      <PerspectiveCamera
        ref={perspRef}
        makeDefault
        position={[2.35, 5.0, 6.7]}
        fov={marketFov}
        near={0.1}
        far={50}
      />
    );
  }

  return (
    <OrthographicCamera
      ref={orthoRef}
      makeDefault
      position={[12, 11.2, 12]}
      zoom={Math.max(46, kitchenZoom)}
      near={0.1}
      far={60}
    />
  );
}
