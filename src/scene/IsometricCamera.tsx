import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import type * as THREE from 'three';

/**
 * Tight isometric orthographic camera that fills the landscape viewport
 * across both widescreen desktops and mobile phones (iPhone 17 Pro / Galaxy S23)
 * with minimal wasted margin around the 8m x 6m room.
 */
export function IsometricCamera() {
  const camRef = useRef<THREE.OrthographicCamera>(null);
  const { size } = useThree();

  // Tightly fit the projected room while keeping back-wall labels cleanly below the top HUD
  const zoom = Math.min(size.width / 9.3, size.height / 6.25);

  useEffect(() => {
    if (!camRef.current) return;
    camRef.current.lookAt(0, 0.72, -0.22);
    camRef.current.updateProjectionMatrix();
  }, [size.width, size.height]);

  return (
    <OrthographicCamera
      ref={camRef}
      makeDefault
      position={[10.5, 10.2, 13.0]}
      zoom={Math.max(46, zoom)}
      near={0.1}
      far={60}
    />
  );
}
