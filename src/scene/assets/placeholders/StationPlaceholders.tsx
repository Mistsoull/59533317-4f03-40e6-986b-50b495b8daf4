import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';

/** All station placeholders strictly adhere to: 1 unit = 1m, bottom-center pivot y = 0 */

export function FridgePlaceholder() {
  return (
    <group>
      {/* Main retro cream body */}
      <mesh position={[0, 0.98, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.96, 1.96, 0.84]} />
        <meshStandardMaterial color="#dce9e4" roughness={0.38} metalness={0.12} />
      </mesh>
      {/* Upper freezer door */}
      <mesh position={[0, 1.56, 0.43]} castShadow>
        <boxGeometry args={[0.88, 0.66, 0.05]} />
        <meshStandardMaterial color="#e8f2ee" roughness={0.32} metalness={0.1} />
      </mesh>
      {/* Lower fridge door */}
      <mesh position={[0, 0.62, 0.43]} castShadow>
        <boxGeometry args={[0.88, 1.12, 0.05]} />
        <meshStandardMaterial color="#e8f2ee" roughness={0.32} metalness={0.1} />
      </mesh>
      {/* Chrome handles */}
      <mesh position={[0.32, 1.52, 0.49]} castShadow>
        <capsuleGeometry args={[0.025, 0.24, 4, 8]} />
        <meshStandardMaterial color="#b8c2c7" roughness={0.25} metalness={0.8} />
      </mesh>
      <mesh position={[0.32, 0.86, 0.49]} castShadow>
        <capsuleGeometry args={[0.025, 0.34, 4, 8]} />
        <meshStandardMaterial color="#b8c2c7" roughness={0.25} metalness={0.8} />
      </mesh>
      {/* Cute fridge magnets */}
      <mesh position={[-0.2, 1.62, 0.47]}>
        <cylinderGeometry args={[0.04, 0.04, 0.02, 10]} />
        <meshStandardMaterial color="#e07a5f" roughness={0.5} />
      </mesh>
      <mesh position={[-0.08, 1.5, 0.47]}>
        <boxGeometry args={[0.14, 0.14, 0.015]} />
        <meshStandardMaterial color="#f2cc8f" roughness={0.8} />
      </mesh>
    </group>
  );
}

export function CuttingBoardPlaceholder() {
  return (
    <group>
      {/* Counter base cabinet */}
      <mesh position={[0, 0.43, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.24, 0.86, 0.86]} />
        <meshStandardMaterial color="#d7c5b2" roughness={0.78} />
      </mesh>
      {/* Countertop surface */}
      <mesh position={[0, 0.89, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.3, 0.07, 0.92]} />
        <meshStandardMaterial color="#f3ebe1" roughness={0.5} />
      </mesh>
      {/* Butcher block wooden cutting board */}
      <mesh position={[-0.06, 0.955, 0.04]} castShadow receiveShadow>
        <boxGeometry args={[0.76, 0.06, 0.54]} />
        <meshStandardMaterial color="#b07d4f" roughness={0.65} />
      </mesh>
      {/* Stylized Chef Knife */}
      <group position={[0.22, 1.0, 0.08]} rotation={[0, -0.45, 0]}>
        <mesh position={[0, 0, -0.1]} castShadow>
          <boxGeometry args={[0.07, 0.015, 0.24]} />
          <meshStandardMaterial color="#d8dee9" roughness={0.22} metalness={0.85} />
        </mesh>
        <mesh position={[0, 0, 0.08]} castShadow>
          <boxGeometry args={[0.045, 0.03, 0.14]} />
          <meshStandardMaterial color="#3b2f2f" roughness={0.75} />
        </mesh>
      </group>
      {/* Decorative tomato & pepper prop */}
      <mesh position={[-0.24, 1.04, -0.05]} castShadow>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshStandardMaterial color="#e63946" roughness={0.45} />
      </mesh>
      <mesh position={[-0.1, 1.03, -0.08]} castShadow>
        <capsuleGeometry args={[0.035, 0.11, 4, 8]} />
        <meshStandardMaterial color="#40916c" roughness={0.5} />
      </mesh>
    </group>
  );
}

export function StovePlaceholder({ isActive }: { isActive: boolean }) {
  const flameRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!flameRef.current) return;
    if (isActive) {
      const s = 0.92 + Math.sin(clock.getElapsedTime() * 14) * 0.12;
      flameRef.current.scale.set(s, 1, s);
    }
  });

  return (
    <group>
      {/* Stove body */}
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.18, 0.9, 0.88]} />
        <meshStandardMaterial color="#4a4e57" roughness={0.45} metalness={0.35} />
      </mesh>
      {/* Oven glass door */}
      <mesh position={[0, 0.36, 0.45]}>
        <boxGeometry args={[0.88, 0.5, 0.04]} />
        <meshStandardMaterial color="#1f2329" roughness={0.2} metalness={0.5} />
      </mesh>
      {/* Oven handle */}
      <mesh position={[0, 0.66, 0.49]} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.02, 0.62, 4, 8]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.25} metalness={0.8} />
      </mesh>
      {/* Cooktop plate */}
      <mesh position={[0, 0.92, 0]} receiveShadow>
        <boxGeometry args={[1.22, 0.05, 0.92]} />
        <meshStandardMaterial color="#272a30" roughness={0.35} metalness={0.4} />
      </mesh>
      {/* 4 Burners */}
      {[
        [-0.28, -0.18],
        [0.28, -0.18],
        [-0.28, 0.2],
        [0.28, 0.2],
      ].map(([bx, bz], i) => (
        <mesh key={i} position={[bx, 0.955, bz]}>
          <cylinderGeometry args={[0.14, 0.15, 0.025, 14]} />
          <meshStandardMaterial color="#16181c" roughness={0.7} />
        </mesh>
      ))}
      {/* Cast-iron pan on front-left burner */}
      <group position={[-0.24, 1.0, 0.18]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.22, 0.19, 0.08, 16]} />
          <meshStandardMaterial color="#2b2d31" roughness={0.5} metalness={0.45} />
        </mesh>
        <mesh position={[0.3, 0.02, 0.04]} rotation={[0, -0.2, Math.PI / 2]}>
          <capsuleGeometry args={[0.022, 0.22, 4, 8]} />
          <meshStandardMaterial color="#2b2d31" roughness={0.5} />
        </mesh>
      </group>
      {/* Active burner glow ring */}
      {isActive && (
        <mesh ref={flameRef} position={[-0.24, 0.968, 0.18]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.13, 0.21, 18]} />
          <meshBasicMaterial color="#ff6b2b" />
        </mesh>
      )}
    </group>
  );
}
