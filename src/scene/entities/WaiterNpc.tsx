import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type * as THREE from 'three';
import { PLAYER_HALF_EXTENT } from '../../config/kitchenLayout';
import type { RecipeId } from '../../config/recipes';
import {
  RESTAURANT_OBSTACLES,
  RESTAURANT_SERVICE_PASS,
  RESTAURANT_TABLES,
  type TableId,
} from '../../config/restaurantLayout';
import { kitchenAudio } from '../../domain/audio';
import { type Vec2 } from '../../domain/collision2d';
import { findPath2D, type NavGrid } from '../../domain/pathfinding';
import { getTranslations } from '../../i18n/translations';
import type { AnimState } from '../../services/supabase/types';
import { restaurantMotionStore } from '../../store/restaurantMotionStore';
import { useGameStore } from '../../store/useGameStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import type { AssetId } from '../assets/assetManifest';
import { ModelSlot } from '../assets/ModelSlot';
import { ChefPlaceholder } from '../assets/placeholders/ChefPlaceholder';

const WAITER_SPEED = 2.75; // brisk, lively bistro waiter pace

type WaiterPhase = 'idle' | 'to_table' | 'placing' | 'returning';

interface ActiveDelivery {
  orderId: string;
  tableId: TableId;
  recipeId: RecipeId;
}

function lerpAngle(current: number, target: number, factor: number): number {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * factor;
}

/**
 * Automatic 3D Waiter NPC (waiter.glb — Idle / Walk / Interact).
 * Watches orders in `status === 'delivering'`, routes locally via 2D A* from the
 * Service Pass counter to the table carrying the 3D dish, drops it off, and returns.
 * Coordinates live purely in mutable refs (NEVER written to Postgres).
 */
export function WaiterNpc({
  navGrid,
  active,
}: {
  navGrid: NavGrid;
  active: boolean;
}) {
  const orders = useGameStore((s) => s.orders);
  const lang = useLanguageStore((s) => s.lang);
  const t = getTranslations(lang);

  const [carryingRecipe, setCarryingRecipe] = useState<RecipeId | null>(null);

  const groupRef = useRef<THREE.Group>(null);
  const animRef = useRef<AnimState>('Idle');
  const stateRef = useRef<{
    x: number;
    z: number;
    rotY: number;
    phase: WaiterPhase;
    waypoints: Vec2[];
    timer: number;
    delivery: ActiveDelivery | null;
  }>({
    x: RESTAURANT_SERVICE_PASS.waiterIdlePoint[0],
    z: RESTAURANT_SERVICE_PASS.waiterIdlePoint[1],
    rotY: RESTAURANT_SERVICE_PASS.waiterIdleFacing,
    phase: 'idle',
    waypoints: [],
    timer: 0,
    delivery: null,
  });

  // Pick next undelivered 'delivering' order whenever Waiter is idle or returning
  useEffect(() => {
    const st = stateRef.current;
    if (st.phase === 'to_table' || st.phase === 'placing') return;

    const pending = orders
      .filter((o) => o.status === 'delivering' && !restaurantMotionStore.isDishPlaced(o.id))
      .sort((a, b) => {
        const at = a.deliveredAt ? new Date(a.deliveredAt).getTime() : 0;
        const bt = b.deliveredAt ? new Date(b.deliveredAt).getTime() : 0;
        return at - bt;
      });

    const next = pending[0];
    if (!next) return;

    const table = RESTAURANT_TABLES[next.tableId];
    const path = findPath2D(
      navGrid,
      { x: st.x, z: st.z },
      { x: table.waiterPoint[0], z: table.waiterPoint[1] },
      PLAYER_HALF_EXTENT,
      RESTAURANT_OBSTACLES,
    );

    st.delivery = {
      orderId: next.id,
      tableId: next.tableId,
      recipeId: next.recipeId,
    };
    st.waypoints = path.length > 0 ? path : [{ x: table.waiterPoint[0], z: table.waiterPoint[1] }];
    st.phase = 'to_table';
    st.timer = 0;
    setCarryingRecipe(next.recipeId);
  }, [orders, navGrid]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const dt = Math.min(delta, 0.05);
    const st = stateRef.current;

    if (st.phase === 'to_table' || st.phase === 'returning') {
      if (st.waypoints.length > 0) {
        const target = st.waypoints[0];
        const dx = target.x - st.x;
        const dz = target.z - st.z;
        const dist = Math.hypot(dx, dz);
        const step = WAITER_SPEED * dt;

        if (dist <= step) {
          st.x = target.x;
          st.z = target.z;
          st.waypoints.shift();
        } else {
          st.x += (dx / dist) * step;
          st.z += (dz / dist) * step;
          const desiredAngle = Math.atan2(dx, dz);
          st.rotY = lerpAngle(st.rotY, desiredAngle, 1 - Math.exp(-14 * dt));
        }
        animRef.current = 'Walk';
      }

      if (st.waypoints.length === 0) {
        if (st.phase === 'to_table' && st.delivery) {
          st.phase = 'placing';
          st.timer = 0;
          animRef.current = 'Interact';
        } else if (st.phase === 'returning') {
          st.phase = 'idle';
          animRef.current = 'Idle';
        }
      }
    } else if (st.phase === 'placing' && st.delivery) {
      const table = RESTAURANT_TABLES[st.delivery.tableId];
      st.rotY = lerpAngle(st.rotY, table.waiterFacing, 1 - Math.exp(-14 * dt));
      animRef.current = 'Interact';
      st.timer += dt;

      if (st.timer >= 0.65) {
        const finishedOrderId = st.delivery.orderId;
        st.delivery = null;
        setCarryingRecipe(null);
        restaurantMotionStore.markDishPlaced(finishedOrderId);
        if (active) {
          kitchenAudio.playTap();
        }

        // Check immediately for any next queued 'delivering' order
        const currentOrders = useGameStore.getState().orders;
        const nextOrder = currentOrders.find(
          (o) =>
            o.status === 'delivering' &&
            o.id !== finishedOrderId &&
            !restaurantMotionStore.isDishPlaced(o.id),
        );

        if (nextOrder) {
          const nextTable = RESTAURANT_TABLES[nextOrder.tableId];
          const pathToNext = findPath2D(
            navGrid,
            { x: st.x, z: st.z },
            { x: nextTable.waiterPoint[0], z: nextTable.waiterPoint[1] },
            PLAYER_HALF_EXTENT,
            RESTAURANT_OBSTACLES,
          );
          st.delivery = {
            orderId: nextOrder.id,
            tableId: nextOrder.tableId,
            recipeId: nextOrder.recipeId,
          };
          st.waypoints =
            pathToNext.length > 0
              ? pathToNext
              : [{ x: nextTable.waiterPoint[0], z: nextTable.waiterPoint[1] }];
          st.phase = 'to_table';
          st.timer = 0;
          setCarryingRecipe(nextOrder.recipeId);
        } else {
          // Walk back home to the Service Pass counter
          const [hx, hz] = RESTAURANT_SERVICE_PASS.waiterIdlePoint;
          const homePath = findPath2D(
            navGrid,
            { x: st.x, z: st.z },
            { x: hx, z: hz },
            PLAYER_HALF_EXTENT,
            RESTAURANT_OBSTACLES,
          );
          st.waypoints = homePath.length > 0 ? homePath : [{ x: hx, z: hz }];
          st.phase = 'returning';
          st.timer = 0;
        }
      }
    } else {
      st.rotY = lerpAngle(st.rotY, RESTAURANT_SERVICE_PASS.waiterIdleFacing, 1 - Math.exp(-8 * dt));
      animRef.current = 'Idle';
    }

    group.position.set(st.x, 0, st.z);
    group.rotation.y = st.rotY;
  });

  const dishAsset = carryingRecipe ? (`dish_${carryingRecipe}` as AssetId) : null;

  return (
    <group
      ref={groupRef}
      position={[
        RESTAURANT_SERVICE_PASS.waiterIdlePoint[0],
        0,
        RESTAURANT_SERVICE_PASS.waiterIdlePoint[1],
      ]}
    >
      <ModelSlot
        assetId="waiter"
        animRef={animRef}
        placeholder={<ChefPlaceholder color="#262b36" animRef={animRef} />}
      />

      {/* Dish carried on the waiter's silver tray while walking to the table */}
      {dishAsset && (
        <group position={[0.28, 0.7, 0.24]} scale={0.78}>
          <ModelSlot assetId={dishAsset} placeholder={null} />
        </group>
      )}

      <mesh position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.28, 16]} />
        <meshBasicMaterial color="#262b36" transparent opacity={0.22} depthWrite={false} />
      </mesh>

      <Html
        position={[0, 1.54, 0]}
        center
        zIndexRange={[5, 0]}
        wrapperClass="pointer-events-none"
        style={{ pointerEvents: 'none' }}
      >
        <div
          className={`rounded-full border border-white/40 bg-slate-800/90 px-2 py-0.5 text-[10px] font-extrabold text-white shadow-sm whitespace-nowrap ${
            active ? '' : 'hidden'
          }`}
        >
          🤵 {t.waiterLabel}
        </div>
      </Html>
    </group>
  );
}
