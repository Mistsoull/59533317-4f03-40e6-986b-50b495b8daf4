import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import type * as THREE from 'three';
import type { RoomId } from '../config/kitchenLayout';

/**
 * Dual-mode angled camera:
 *  - Kitchen: high top-down angled diagonal OrthographicCamera (~49° pitch)
 *    for crisp overview of floor, island, stations, and doorway
 *  - Market: immersive full-screen enclosed interior PerspectiveCamera angled diagonally
 */
export function IsometricCamera({ room }: { room: RoomId }) {
  const orthoRef = useRef<THREE.OrthographicCamera>(null);
  const perspRef = useRef<THREE.PerspectiveCamera>(null);
  const { size } = useThree();

  const aspect = size.width / Math.max(1, size.height);
  const kitchenZoom = Math.min(size.width / 9.8, size.height / 7.2);
  const marketFov = aspect < 1.35 ? 48 : aspect > 1.95 ? 36 : 42;

  useEffect(() => {
    if (room === 'kitchen' && orthoRef.current) {
      orthoRef.current.lookAt(0, 0.35, -0.2);
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
      position={[9.0, 15.8, 10.2]}
      zoom={Math.max(44, kitchenZoom)}
      near={0.1}
      far={60}
    />
  );
}
