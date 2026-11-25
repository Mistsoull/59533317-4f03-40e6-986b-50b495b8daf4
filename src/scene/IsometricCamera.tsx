import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import type * as THREE from 'three';

/**
 * Fixed isometric orthographic camera that auto-fits the 8m x 6m kitchen
 * across landscape mobile screens (iPhone 17 Pro & Samsung S23) and desktops.
 */
export function IsometricCamera() {
  const camRef = useRef<THREE.OrthographicCamera>(null);
  const { size } = useThree();

  // Isometric bounding span of an 8m x 6m room with headroom for the top HUD & fridge
  const zoom = Math.min(size.width / 12.2, size.height / 8.3);

  useEffect(() => {
    if (!camRef.current) return;
    camRef.current.lookAt(0, 0.72, -0.35);
    camRef.current.updateProjectionMatrix();
  }, [size.width, size.height]);

  return (
    <OrthographicCamera
      ref={camRef}
      makeDefault
      position={[12, 11.5, 12]}
      zoom={Math.max(32, zoom)}
      near={0.1}
      far={60}
    />
  );
}
