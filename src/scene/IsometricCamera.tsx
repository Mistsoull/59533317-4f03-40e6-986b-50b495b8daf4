import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import type * as THREE from 'three';
import type { RoomId } from '../config/kitchenLayout';

/**
 * Full-screen enclosed interior PerspectiveCamera for all 3 rooms:
 *  - Kitchen & Restaurant: diagonal enclosed interior framing all stations, doors,
 *    tables, Waiter NPC & guests edge-to-edge with zero outer void.
 *  - Market: diagonal enclosed grocery shop interior with zero outer void.
 */
export function IsometricCamera({ room }: { room: RoomId }) {
  const perspRef = useRef<THREE.PerspectiveCamera>(null);
  const { size } = useThree();

  const aspect = size.width / Math.max(1, size.height);
  const marketFov = aspect < 1.35 ? 48 : aspect > 1.95 ? 36 : 42;
  const roomFov = aspect < 1.5 ? 50 : aspect > 1.95 ? 40 : 46;

  const isMarket = room === 'market';
  const position: [number, number, number] = isMarket
    ? [2.35, 5.0, 6.7]
    : [1.45, 5.35, 7.45];
  const fov = isMarket ? marketFov : roomFov;

  useEffect(() => {
    if (!perspRef.current) return;
    if (room === 'market') {
      perspRef.current.lookAt(-0.35, 0.92, -1.35);
    } else {
      perspRef.current.lookAt(-0.1, 0.65, -0.65);
    }
    perspRef.current.updateProjectionMatrix();
  }, [room, size.width, size.height]);

  return (
    <PerspectiveCamera
      ref={perspRef}
      makeDefault
      position={position}
      fov={fov}
      near={0.1}
      far={50}
    />
  );
}
