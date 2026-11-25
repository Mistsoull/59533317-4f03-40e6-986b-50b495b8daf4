import { useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { AnimState } from '../../../services/supabase/types';

interface ChefPlaceholderProps {
  color: string;
  animRef: MutableRefObject<AnimState>;
}

/**
 * Stylized low-poly chef placeholder (1 unit = 1m, pivot strictly at y = 0 bottom center).
 * Animates Idle / Walk / Interact procedurally in useFrame without React re-renders.
 */
export function ChefPlaceholder({ color, animRef }: ChefPlaceholderProps) {
  const bodyRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const phaseRef = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const anim = animRef.current;

    if (anim === 'Walk') {
      phaseRef.current += dt * 11;
      const swing = Math.sin(phaseRef.current) * 0.55;
      const bob = Math.abs(Math.sin(phaseRef.current)) * 0.05;
      if (bodyRef.current) bodyRef.current.position.y = bob;
      if (leftArmRef.current) leftArmRef.current.rotation.x = swing;
      if (rightArmRef.current) rightArmRef.current.rotation.x = -swing;
      if (leftLegRef.current) leftLegRef.current.rotation.x = -swing * 0.85;
      if (rightLegRef.current) rightLegRef.current.rotation.x = swing * 0.85;
    } else if (anim === 'Interact') {
      phaseRef.current += dt * 14;
      const chop = Math.sin(phaseRef.current) * 0.45 - 0.85;
      if (bodyRef.current) bodyRef.current.position.y = Math.sin(phaseRef.current * 0.5) * 0.015;
      if (leftArmRef.current) leftArmRef.current.rotation.x = -0.65;
      if (rightArmRef.current) rightArmRef.current.rotation.x = chop;
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
    } else {
      phaseRef.current += dt * 2.5;
      const breath = Math.sin(phaseRef.current) * 0.015;
      if (bodyRef.current) bodyRef.current.position.y = breath;
      if (leftArmRef.current) leftArmRef.current.rotation.x *= 0.85;
      if (rightArmRef.current) rightArmRef.current.rotation.x *= 0.85;
      if (leftLegRef.current) leftLegRef.current.rotation.x *= 0.85;
      if (rightLegRef.current) rightLegRef.current.rotation.x *= 0.85;
    }
  });

  return (
    <group>
      {/* Legs (feet touch y = 0) */}
      <mesh ref={leftLegRef} position={[-0.1, 0.22, 0]} castShadow>
        <capsuleGeometry args={[0.075, 0.22, 4, 8]} />
        <meshStandardMaterial color="#3b332c" roughness={0.85} />
      </mesh>
      <mesh ref={rightLegRef} position={[0.1, 0.22, 0]} castShadow>
        <capsuleGeometry args={[0.075, 0.22, 4, 8]} />
        <meshStandardMaterial color="#3b332c" roughness={0.85} />
      </mesh>

      {/* Upper body group */}
      <group ref={bodyRef}>
        {/* Torso & Chef Jacket */}
        <mesh position={[0, 0.66, 0]} castShadow>
          <capsuleGeometry args={[0.21, 0.28, 6, 12]} />
          <meshStandardMaterial color="#faf5ef" roughness={0.75} />
        </mesh>

        {/* Colored Apron front */}
        <mesh position={[0, 0.56, 0.14]} castShadow>
          <boxGeometry args={[0.3, 0.4, 0.15]} />
          <meshStandardMaterial color={color} roughness={0.65} />
        </mesh>

        {/* Arms */}
        <mesh ref={leftArmRef} position={[-0.27, 0.68, 0]} castShadow>
          <capsuleGeometry args={[0.065, 0.22, 4, 8]} />
          <meshStandardMaterial color="#faf5ef" roughness={0.75} />
        </mesh>
        <mesh ref={rightArmRef} position={[0.27, 0.68, 0]} castShadow>
          <capsuleGeometry args={[0.065, 0.22, 4, 8]} />
          <meshStandardMaterial color="#faf5ef" roughness={0.75} />
        </mesh>

        {/* Head */}
        <mesh position={[0, 1.08, 0]} castShadow>
          <sphereGeometry args={[0.19, 14, 14]} />
          <meshStandardMaterial color="#f5cba7" roughness={0.7} />
        </mesh>

        {/* Eyes (facing +Z forward) */}
        <mesh position={[-0.065, 1.1, 0.165]}>
          <sphereGeometry args={[0.024, 8, 8]} />
          <meshStandardMaterial color="#231f20" roughness={0.3} />
        </mesh>
        <mesh position={[0.065, 1.1, 0.165]}>
          <sphereGeometry args={[0.024, 8, 8]} />
          <meshStandardMaterial color="#231f20" roughness={0.3} />
        </mesh>

        {/* Chef Toque Hat */}
        <mesh position={[0, 1.28, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.14, 0.14, 12]} />
          <meshStandardMaterial color="#ffffff" roughness={0.65} />
        </mesh>
        <mesh position={[0, 1.4, 0]} castShadow>
          <sphereGeometry args={[0.19, 12, 10]} />
          <meshStandardMaterial color="#ffffff" roughness={0.65} />
        </mesh>
        {/* Hat ribbon matching player color */}
        <mesh position={[0, 1.22, 0]}>
          <cylinderGeometry args={[0.155, 0.155, 0.04, 12]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
}
