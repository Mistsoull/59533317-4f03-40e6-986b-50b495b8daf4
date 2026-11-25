import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import type * as THREE from 'three';
import type { RoomId } from '../config/kitchenLayout';

/**
 * Dual-mode camera:
 *  - Kitchen: cozy isometric OrthographicCamera (kept as-is)
 *  - Market: full-screen enclosed interior PerspectiveCamera from a high top-down
 *    diagonal angle (~48° pitch) with zero outer void
 */
export function IsometricCamera({ room }: { room: RoomId }) {
  const orthoRef = useRef<THREE.OrthographicCamera>(null);
  const perspRef = useRef<THREE.PerspectiveCamera>(null);
  const { size } = useThree();

  const aspect = size.width / Math.max(1, size.height);
  const kitchenZoom = Math.min(size.width / 9.3, size.height / 6.25);
  const marketFov = aspect < 1.35 ? 50 : aspect > 1.95 ? 38 : 44;

  useEffect(() => {
    if (room === 'kitchen' && orthoRef.current) {
      orthoRef.current.lookAt(0, 0.72, -0.22);
      orthoRef.current.updateProjectionMatrix();
    } else if (room === 'market' && perspRef.current) {
      perspRef.current.lookAt(-0.3, 0.45, -0.85);
      perspRef.current.updateProjectionMatrix();
    }
  }, [room, size.width, size.height]);

  if (room === 'market') {
    return (
      <PerspectiveCamera
        ref={perspRef}
        makeDefault
        position={[2.6, 8.2, 5.6]}
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
      position={[10.5, 10.2, 13.0]}
      zoom={Math.max(46, kitchenZoom)}
      near={0.1}
      far={60}
    />
  );
}
