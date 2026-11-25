import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { RECIPES } from '../../config/recipes';
import type { RestaurantTableDef } from '../../config/restaurantLayout';
import { evaluateOrderPatience } from '../../domain/restaurantRules';
import { getTranslations } from '../../i18n/translations';
import { restaurantMotionStore } from '../../store/restaurantMotionStore';
import { useGameStore } from '../../store/useGameStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import type { AssetId } from '../assets/assetManifest';
import { ModelSlot } from '../assets/ModelSlot';

const COLOR_HAPPY = new THREE.Color('#22c55e');
const COLOR_IMPATIENT = new THREE.Color('#f59e0b');
const COLOR_URGENT = new THREE.Color('#ef4444');

/**
 * 3D Bistro Table + Chair + Placed Cooked Dish + Ref-driven 3D Patience Bar.
 * Zero 60 FPS React state updates: the WebGL patience gauge scales & recolors directly
 * via mutable Three.js refs inside useFrame!
 */
export function RestaurantTableInteractable({
  table,
  active,
}: {
  table: RestaurantTableDef;
  active: boolean;
}) {
  const order = useGameStore((s) =>
    s.orders.find((o) => o.tableId === table.id && (o.status === 'waiting' || o.status === 'delivering')),
  );
  const lang = useLanguageStore((s) => s.lang);
  const t = getTranslations(lang);

  const [dishPlaced, setDishPlaced] = useState(false);

  // Sync low-frequency dishPlaced flag (only fires once when Waiter drops off plate)
  useEffect(() => {
    if (!order) {
      setDishPlaced(false);
      return;
    }
    setDishPlaced(restaurantMotionStore.isDishPlaced(order.id));
    return restaurantMotionStore.subscribe(() => {
      setDishPlaced(restaurantMotionStore.isDishPlaced(order.id));
    });
  }, [order?.id]);

  // Ref-driven 3D patience gauge (0 React re-renders per frame!)
  const barGroupRef = useRef<THREE.Group>(null);
  const barFillRef = useRef<THREE.Mesh>(null);
  const barMatRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ camera }) => {
    const barGroup = barGroupRef.current;
    const barFill = barFillRef.current;
    const barMat = barMatRef.current;
    if (!barGroup || !barFill || !barMat) return;

    const showBar = active && Boolean(order && order.status === 'waiting');
    barGroup.visible = showBar;
    if (!showBar || !order) return;

    // Face camera cleanly
    barGroup.quaternion.copy(camera.quaternion);

    const clockOffsetMs = useGameStore.getState().clockOffsetMs;
    const snap = evaluateOrderPatience(
      order.createdAt,
      order.expiresAt,
      Date.now() + clockOffsetMs,
    );

    const width = Math.max(0.001, snap.ratio);
    barFill.scale.x = width;
    barFill.position.x = -(1 - width) * 0.44;

    if (snap.level === 'happy') {
      barMat.color.copy(COLOR_HAPPY);
    } else if (snap.level === 'impatient') {
      barMat.color.copy(COLOR_IMPATIENT);
    } else {
      barMat.color.copy(COLOR_URGENT);
    }
  });

  const [tx, ty, tz] = table.position;
  const [sx, sz] = table.seatPoint;
  const [dx, dy, dz] = table.dishPosition;
  const recipe = order ? RECIPES[order.recipeId] : null;
  const showPlacedDish = Boolean(order && order.status === 'delivering' && dishPlaced);

  const diffDot =
    order?.difficulty === 'easy'
      ? 'bg-emerald-500'
      : order?.difficulty === 'medium'
        ? 'bg-amber-500'
        : 'bg-rose-500';

  return (
    <group>
      {/* Bistro Table Model */}
      <group position={[tx, ty, tz]}>
        <ModelSlot assetId="restaurant_table" placeholder={null} />
      </group>

      {/* Cozy Wooden Bistro Chair at customer seatPoint */}
      <group position={[sx, 0, sz]} rotation={[0, table.seatFacing, 0]}>
        <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.42, 0.06, 0.42]} />
          <meshStandardMaterial color="#9c6644" roughness={0.72} />
        </mesh>
        <mesh position={[0, 0.56, -0.18]} castShadow>
          <boxGeometry args={[0.42, 0.58, 0.06]} />
          <meshStandardMaterial color="#8c5a34" roughness={0.72} />
        </mesh>
        {[
          [-0.17, 0.12, -0.17],
          [0.17, 0.12, -0.17],
          [-0.17, 0.12, 0.17],
          [0.17, 0.12, 0.17],
        ].map(([lx, ly, lz], i) => (
          <mesh key={i} position={[lx, ly, lz]} castShadow>
            <boxGeometry args={[0.05, 0.24, 0.05]} />
            <meshStandardMaterial color="#6e472b" roughness={0.78} />
          </mesh>
        ))}
      </group>

      {/* Served 3D Dish placed on table by the Waiter NPC */}
      {showPlacedDish && order && (
        <group position={[dx, dy, dz]} scale={0.95}>
          <ModelSlot assetId={`dish_${order.recipeId}` as AssetId} placeholder={null} />
        </group>
      )}

      {/* Pure WebGL 3D Patience Progress Bar (60 FPS mutable ref, ZERO React state ticks) */}
      <group ref={barGroupRef} position={[tx, 1.62, tz]} visible={false}>
        <mesh position={[0, 0, -0.005]}>
          <planeGeometry args={[0.94, 0.11]} />
          <meshBasicMaterial color="#1f2937" transparent opacity={0.85} />
        </mesh>
        <mesh ref={barFillRef} position={[0, 0, 0.002]}>
          <planeGeometry args={[0.88, 0.07]} />
          <meshBasicMaterial ref={barMatRef} color="#22c55e" />
        </mesh>
      </group>

      {/* Static low-frequency Order Badge above Table */}
      <Html
        position={[tx, 1.95, tz]}
        center
        zIndexRange={[5, 0]}
        wrapperClass="pointer-events-none"
        style={{ pointerEvents: 'none' }}
      >
        <div className={active ? 'flex flex-col items-center gap-0.5' : 'hidden'}>
          {order && recipe ? (
            order.status === 'waiting' ? (
              <div className="flex items-center gap-1.5 rounded-full border border-white/60 bg-white/95 px-2.5 py-0.5 text-[11px] font-extrabold text-stone-800 shadow-md whitespace-nowrap dark:border-stone-700 dark:bg-stone-900/95 dark:text-stone-100">
                <span className={`h-2 w-2 rounded-full ${diffDot}`} />
                <span>{recipe.icon}</span>
                <span>{t.recipes[recipe.id].name}</span>
              </div>
            ) : dishPlaced ? (
              <div className="rounded-full border border-emerald-300 bg-emerald-600/95 px-2.5 py-0.5 text-[11px] font-extrabold text-white shadow-md whitespace-nowrap">
                😋 +🪙 {order.rewardCoins + order.tipCoins}
              </div>
            ) : (
              <div className="rounded-full border border-sky-300 bg-sky-600/95 px-2.5 py-0.5 text-[11px] font-extrabold text-white shadow-md whitespace-nowrap">
                🤵 {t.waiterDeliveringShort}
              </div>
            )
          ) : (
            <div className="rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-bold text-white/90 whitespace-nowrap">
              {t.tableLabel(table.tableNumber)}
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}
