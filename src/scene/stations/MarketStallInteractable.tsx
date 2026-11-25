import { useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { MARKET_STALLS, type MarketStallId } from '../../config/marketLayout';
import { ModelSlot } from '../assets/ModelSlot';

interface MarketStallInteractableProps {
  stallId: MarketStallId;
  active: boolean;
  onSelectStall: (stallId: MarketStallId) => void;
}

export function MarketStallInteractable({
  stallId,
  active,
  onSelectStall,
}: MarketStallInteractableProps) {
  const def = MARKET_STALLS[stallId];
  const downPosRef = useRef<{ x: number; y: number } | null>(null);

  const [sx, sy, sz] = def.position;
  const [ix, iz] = def.interactionPoint;
  const [hx, hy, hz] = def.hitboxSize;

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
    onSelectStall(stallId);
  };

  const stallAsset =
    stallId === 'produce'
      ? 'market_produce'
      : stallId === 'dairy'
        ? 'market_dairy'
        : 'market_pantry';

  return (
    <group>
      <group position={[sx, sy, sz]}>
        <ModelSlot assetId={stallAsset} placeholder={null} />

        {/* Real sculpted 3D food products arranged on each stall! */}
        {stallId === 'produce' && (
          <>
            <group position={[-0.78, 0.78, 0.08]} scale={1.1}>
              <ModelSlot assetId="food_domates" placeholder={null} />
            </group>
            <group position={[-0.26, 0.78, 0.05]} scale={1.1}>
              <ModelSlot assetId="food_biber" placeholder={null} />
            </group>
            <group position={[0.26, 0.78, 0.08]} scale={1.1}>
              <ModelSlot assetId="food_mantar" placeholder={null} />
            </group>
            <group position={[0.78, 0.78, 0.08]} scale={1.1}>
              <ModelSlot assetId="food_cilek" placeholder={null} />
            </group>
          </>
        )}

        {stallId === 'dairy' && (
          <>
            <group position={[-0.36, 0.6, 0.08]} scale={1.1}>
              <ModelSlot assetId="food_yumurta" placeholder={null} />
            </group>
            <group position={[0.32, 0.6, 0.08]} scale={1.15}>
              <ModelSlot assetId="food_yumurta" placeholder={null} />
            </group>
            <group position={[-0.36, 1.1, 0.04]} scale={1.15}>
              <ModelSlot assetId="food_sut" placeholder={null} />
            </group>
            <group position={[0.0, 1.1, 0.04]} scale={1.15}>
              <ModelSlot assetId="food_sut" placeholder={null} />
            </group>
            <group position={[0.38, 1.1, 0.04]} scale={1.15}>
              <ModelSlot assetId="food_krema" placeholder={null} />
            </group>
          </>
        )}

        {stallId === 'pantry' && (
          <>
            <group position={[-0.3, 0.6, 0.06]} scale={1.2}>
              <ModelSlot assetId="food_makarna" placeholder={null} />
            </group>
            <group position={[0.28, 0.6, 0.06]} scale={1.2}>
              <ModelSlot assetId="food_un" placeholder={null} />
            </group>
            <group position={[-0.28, 1.17, 0.04]} scale={1.15}>
              <ModelSlot assetId="food_un" placeholder={null} />
            </group>
            <group position={[0.28, 1.17, 0.04]} scale={1.15}>
              <ModelSlot assetId="food_makarna" placeholder={null} />
            </group>
          </>
        )}

        {/* Generous touch hitbox */}
        <mesh
          position={[0, hy * 0.5, 0]}
          onPointerDown={handleDown}
          onPointerUp={handleUp}
        >
          <boxGeometry args={[hx, hy, hz]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        <Html
          position={[0, stallId === 'produce' ? 1.72 : 1.98, 0.4]}
          center
          zIndexRange={[5, 0]}
          wrapperClass="pointer-events-none"
          style={{ pointerEvents: 'none' }}
        >
          <div
            className={`ui-card rounded-full px-2.5 py-0.5 text-[11px] font-extrabold shadow-md whitespace-nowrap ${
              active ? '' : 'hidden'
            }`}
          >
            {def.icon} {def.label}
          </div>
        </Html>
      </group>

      {/* Floor interaction ring */}
      <mesh
        position={[ix, 0.018, iz]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={handleDown}
        onPointerUp={handleUp}
      >
        <ringGeometry args={[0.26, 0.36, 24]} />
        <meshBasicMaterial color="#e07a5f" transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </group>
  );
}
