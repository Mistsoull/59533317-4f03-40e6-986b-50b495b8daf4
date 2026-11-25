import { useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { COOKED_ITEMS } from '../../config/ingredients';
import { getTranslations } from '../../i18n/translations';
import { useGameStore } from '../../store/useGameStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import type { AssetId } from '../assets/assetManifest';
import { ModelSlot } from '../assets/ModelSlot';

interface ServicePassInteractableProps {
  position: readonly [number, number, number];
  interactionPoint: readonly [number, number];
  active: boolean;
  onSelectPass: () => void;
}

/**
 * Service Pass Counter & Brass Bell (used in both Kitchen and Restaurant).
 * Displays cooked ready dishes waiting for the Waiter NPC or takeout sale.
 */
export function ServicePassInteractable({
  position,
  interactionPoint,
  active,
  onSelectPass,
}: ServicePassInteractableProps) {
  const inventory = useGameStore((s) => s.inventory);
  const orders = useGameStore((s) => s.orders);
  const lang = useLanguageStore((s) => s.lang);
  const t = getTranslations(lang);

  const downPosRef = useRef<{ x: number; y: number } | null>(null);

  const readyDishes = COOKED_ITEMS.filter((item) => (inventory[item.id] ?? 0) > 0);
  const totalReadyCount = readyDishes.reduce((sum, d) => sum + (inventory[d.id] ?? 0), 0);
  const waitingMatchCount = orders.filter(
    (o) => o.status === 'waiting' && (inventory[`dish_${o.recipeId}`] ?? 0) > 0,
  ).length;

  const handleDown = (e: ThreeEvent<PointerEvent>) => {
    if (!active) return;
    e.stopPropagation();
    downPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleUp = (e: ThreeEvent<PointerEvent>) => {
    if (!active) return;
    e.stopPropagation();
    if (!downPosRef.current) return;
    const moved = Math.hypot(e.clientX - downPosRef.current.x, e.clientY - downPosRef.current.y);
    downPosRef.current = null;
    if (moved > 14) return;
    onSelectPass();
  };

  const [px, py, pz] = position;
  const [ix, iz] = interactionPoint;

  return (
    <group>
      <group position={[px, py, pz]} onPointerDown={handleDown} onPointerUp={handleUp}>
        {/* Warm oak pass counter base (y = 0 bottom) */}
        <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.64, 0.84, 1.12]} />
          <meshStandardMaterial color="#b07d4f" roughness={0.72} />
        </mesh>
        {/* Cream marble serving counter top */}
        <mesh position={[0, 0.875, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.72, 0.07, 1.18]} />
          <meshStandardMaterial color="#fff8ee" roughness={0.4} />
        </mesh>

        {/* Brass Service Bell on counter front */}
        <group position={[0, 0.91, -0.36]}>
          <mesh position={[0, 0.015, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.11, 0.03, 14]} />
            <meshStandardMaterial color="#3c3f46" roughness={0.45} metalness={0.5} />
          </mesh>
          <mesh position={[0, 0.055, 0]} castShadow>
            <sphereGeometry args={[0.085, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            <meshStandardMaterial
              color="#f4c430"
              emissive={waitingMatchCount > 0 ? '#f59e0b' : '#000000'}
              emissiveIntensity={waitingMatchCount > 0 ? 0.35 : 0}
              roughness={0.2}
              metalness={0.85}
            />
          </mesh>
          <mesh position={[0, 0.145, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.025, 10]} />
            <meshStandardMaterial color="#ffe066" roughness={0.2} metalness={0.9} />
          </mesh>
        </group>

        {/* Visual ready 3D dishes resting on the pass counter */}
        {readyDishes.slice(0, 2).map((dish, idx) => (
          <group
            key={dish.id}
            position={[0.02, 0.91, 0.08 + idx * 0.34]}
            scale={0.85}
          >
            <ModelSlot assetId={dish.id as AssetId} placeholder={null} />
          </group>
        ))}

        {/* Floating service pass badge */}
        <Html
          position={[0, 1.52, 0]}
          center
          zIndexRange={[5, 0]}
          wrapperClass="pointer-events-none"
          style={{ pointerEvents: 'none' }}
        >
          <div className={`flex flex-col items-center gap-0.5 ${active ? '' : 'hidden'}`}>
            <div
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold shadow-md whitespace-nowrap ${
                waitingMatchCount > 0
                  ? 'animate-pulse border-emerald-300 bg-emerald-600/95 text-white'
                  : 'border-amber-200/70 bg-amber-600/95 text-white'
              }`}
            >
              🔔 {t.servicePassLabel}
              {totalReadyCount > 0 ? ` (${totalReadyCount})` : ''}
            </div>
          </div>
        </Html>
      </group>

      {/* Subtle floor interaction ring */}
      <mesh
        position={[ix, 0.022, iz]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={handleDown}
        onPointerUp={handleUp}
      >
        <ringGeometry args={[0.24, 0.33, 24]} />
        <meshBasicMaterial
          color={waitingMatchCount > 0 ? '#22c55e' : '#d97706'}
          transparent
          opacity={waitingMatchCount > 0 ? 0.78 : 0.45}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
