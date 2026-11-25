import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import type * as THREE from 'three';
import type { RoomId } from '../config/kitchenLayout';

/**
 * Dual-mode camera:
 *  - Kitchen: crisp isometric OrthographicCamera tightly framing the 8m x 6m kitchen
 *  - Market: immersive interior PerspectiveCamera placed INSIDE the 3-walled grocery shop
 *    so the shop fills 100% of the viewport edge-to-edge with zero outside void.
 */
export function IsometricCamera({ room }: { room: RoomId }) {
  const orthoRef = useRef<THREE.OrthographicCamera>(null);
  const perspRef = useRef<THREE.PerspectiveCamera>(null);
  const { size } = useThree();

  const aspect = size.width / Math.max(1, size.height);
  const kitchenZoom = Math.min(size.width / 9.3, size.height / 6.25);
  // Adapt Market interior FOV by viewport aspect so Door + all 3 Stalls + Walls fill 100% edge-to-edge
  const marketFov = aspect < 1.35 ? 48 : aspect > 1.95 ? 36 : 42;

  useEffect(() => {
    if (room === 'kitchen' && orthoRef.current) {
      orthoRef.current.lookAt(0, 0.72, -0.22);
      orthoRef.current.updateProjectionMatrix();
    } else if (room === 'market' && perspRef.current) {
      perspRef.current.lookAt(-0.1, 0.95, -1.4);
      perspRef.current.updateProjectionMatrix();
    }
  }, [room, size.width, size.height]);

  if (room === 'market') {
    return (
      <PerspectiveCamera
        ref={perspRef}
        makeDefault
        position={[0.0, 5.15, 7.15]}
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
