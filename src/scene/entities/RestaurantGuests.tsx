import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type * as THREE from 'three';
import { PLAYER_HALF_EXTENT } from '../../config/kitchenLayout';
import {
  RESTAURANT_OBSTACLES,
  RESTAURANT_STREET_ENTRANCE,
  RESTAURANT_TABLES,
  type CustomerAvatarId,
  type TableId,
} from '../../config/restaurantLayout';
import type { Vec2 } from '../../domain/collision2d';
import { findPath2D, type NavGrid } from '../../domain/pathfinding';
import { completeRestaurantOrder } from '../../services/supabase/homeRepository';
import type { AnimState, RestaurantOrderRow } from '../../services/supabase/types';
import { restaurantMotionStore } from '../../store/restaurantMotionStore';
import { useGameStore } from '../../store/useGameStore';
import { ModelSlot } from '../assets/ModelSlot';
import { ChefPlaceholder } from '../assets/placeholders/ChefPlaceholder';

const CUSTOMER_SPEED = 2.05;
const EAT_DURATION_SEC = 4.0;

type GuestPhase = 'entering' | 'seated' | 'eating' | 'leaving_happy' | 'leaving_sad';

interface VisualGuest {
  orderId: string;
  tableId: TableId;
  avatar: CustomerAvatarId;
  name: string;
  initialSeated: boolean;
  leavingMood: 'happy' | 'sad' | null;
}

function lerpAngle(current: number, target: number, factor: number): number {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * factor;
}

function CustomerActor({
  guest,
  order,
  navGrid,
  active,
  onDespawn,
}: {
  guest: VisualGuest;
  order: RestaurantOrderRow | undefined;
  navGrid: NavGrid;
  active: boolean;
  onDespawn: (orderId: string) => void;
}) {
  const table = RESTAURANT_TABLES[guest.tableId];
  const [startX, startZ] = guest.initialSeated
    ? table.seatPoint
    : RESTAURANT_STREET_ENTRANCE.spawnPoint;

  const groupRef = useRef<THREE.Group>(null);
  const animRef = useRef<AnimState>(guest.initialSeated ? 'Idle' : 'Walk');
  const [moodEmoji, setMoodEmoji] = useState<string | null>(null);

  const stRef = useRef<{
    x: number;
    z: number;
    rotY: number;
    phase: GuestPhase;
    waypoints: Vec2[];
    eatTimer: number;
    despawned: boolean;
  }>({
    x: startX,
    z: startZ,
    rotY: guest.initialSeated ? table.seatFacing : 0,
    phase: guest.initialSeated ? 'seated' : 'entering',
    waypoints: guest.initialSeated
      ? []
      : findPath2D(
          navGrid,
          { x: startX, z: startZ },
          { x: table.seatPoint[0], z: table.seatPoint[1] },
          PLAYER_HALF_EXTENT,
          RESTAURANT_OBSTACLES,
        ),
    eatTimer: 0,
    despawned: false,
  });

  // React to order removal (expired or served externally) -> trigger departure walk!
  useEffect(() => {
    const st = stRef.current;
    if (guest.leavingMood && st.phase !== 'leaving_happy' && st.phase !== 'leaving_sad') {
      const nextPhase: GuestPhase =
        guest.leavingMood === 'happy' ? 'leaving_happy' : 'leaving_sad';
      st.phase = nextPhase;
      setMoodEmoji(guest.leavingMood === 'happy' ? '😊' : '😔');
      const [ex, ez] = RESTAURANT_STREET_ENTRANCE.exitPoint;
      const exitPath = findPath2D(
        navGrid,
        { x: st.x, z: st.z },
        { x: ex, z: ez },
        PLAYER_HALF_EXTENT,
        RESTAURANT_OBSTACLES,
      );
      st.waypoints = exitPath.length > 0 ? exitPath : [{ x: ex, z: ez }];
    }
  }, [guest.leavingMood, navGrid]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const dt = Math.min(delta, 0.05);
    const st = stRef.current;

    // Check if Waiter NPC placed this guest's dish on the table!
    if (
      (st.phase === 'seated' || st.phase === 'entering') &&
      order?.status === 'delivering' &&
      restaurantMotionStore.isDishPlaced(guest.orderId)
    ) {
      st.phase = 'eating';
      st.x = table.seatPoint[0];
      st.z = table.seatPoint[1];
      st.waypoints = [];
      st.eatTimer = 0;
      setMoodEmoji('😋');
    }

    if (st.phase === 'entering' || st.phase === 'leaving_happy' || st.phase === 'leaving_sad') {
      if (st.waypoints.length > 0) {
        const target = st.waypoints[0];
        const dx = target.x - st.x;
        const dz = target.z - st.z;
        const dist = Math.hypot(dx, dz);
        const step = CUSTOMER_SPEED * dt;

        if (dist <= step) {
          st.x = target.x;
          st.z = target.z;
          st.waypoints.shift();
        } else {
          st.x += (dx / dist) * step;
          st.z += (dz / dist) * step;
          st.rotY = lerpAngle(st.rotY, Math.atan2(dx, dz), 1 - Math.exp(-12 * dt));
        }
        animRef.current = 'Walk';
      }

      if (st.waypoints.length === 0) {
        if (st.phase === 'entering') {
          st.phase = 'seated';
          animRef.current = 'Idle';
        } else if (!st.despawned) {
          st.despawned = true;
          restaurantMotionStore.clearOrder(guest.orderId);
          onDespawn(guest.orderId);
          return;
        }
      }
    } else if (st.phase === 'seated') {
      st.rotY = lerpAngle(st.rotY, table.seatFacing, 1 - Math.exp(-10 * dt));
      animRef.current = 'Idle';
    } else if (st.phase === 'eating') {
      st.rotY = lerpAngle(st.rotY, table.seatFacing, 1 - Math.exp(-10 * dt));
      animRef.current = 'Interact';
      st.eatTimer += dt;

      if (st.eatTimer >= EAT_DURATION_SEC) {
        st.phase = 'leaving_happy';
        setMoodEmoji('😊');
        restaurantMotionStore.clearOrder(guest.orderId);

        if (restaurantMotionStore.markFinalizedOnce(guest.orderId)) {
          void completeRestaurantOrder(guest.orderId);
        }

        const [ex, ez] = RESTAURANT_STREET_ENTRANCE.exitPoint;
        const exitPath = findPath2D(
          navGrid,
          { x: st.x, z: st.z },
          { x: ex, z: ez },
          PLAYER_HALF_EXTENT,
          RESTAURANT_OBSTACLES,
        );
        st.waypoints = exitPath.length > 0 ? exitPath : [{ x: ex, z: ez }];
      }
    }

    group.position.set(st.x, 0, st.z);
    group.rotation.y = st.rotY;
  });

  return (
    <group ref={groupRef} position={[startX, 0, startZ]}>
      <ModelSlot
        assetId={guest.avatar}
        animRef={animRef}
        placeholder={<ChefPlaceholder color="#e76f51" animRef={animRef} />}
      />
      <mesh position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.27, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      {moodEmoji && (
        <Html
          position={[0, 1.56, 0]}
          center
          zIndexRange={[6, 0]}
          wrapperClass="pointer-events-none"
          style={{ pointerEvents: 'none' }}
        >
          <div
            className={`rounded-full bg-white/95 px-2 py-0.5 text-sm shadow-md ${
              active ? '' : 'hidden'
            }`}
          >
            {moodEmoji}
          </div>
        </Html>
      )}
    </group>
  );
}

/**
 * Renders all Customer NPCs walking in from the street entrance, sitting at their assigned
 * tables, eating once served by the Waiter NPC, and walking back out cleanly.
 */
export function RestaurantGuests({
  navGrid,
  active,
}: {
  navGrid: NavGrid;
  active: boolean;
}) {
  const orders = useGameStore((s) => s.orders);
  const clockOffsetMs = useGameStore((s) => s.clockOffsetMs);
  const [guests, setGuests] = useState<VisualGuest[]>([]);
  const hadDeliveredRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const nowMs = Date.now() + clockOffsetMs;
    for (const o of orders) {
      if (o.status === 'delivering') {
        hadDeliveredRef.current.add(o.id);
      }
    }

    setGuests((prev) => {
      const orderById = new Map(orders.map((o) => [o.id, o]));
      const next: VisualGuest[] = [];

      // Keep existing guests; mark vanished orders as leaving (happy if delivered, sad if expired)
      for (const g of prev) {
        const live = orderById.get(g.orderId);
        if (live) {
          next.push(g);
        } else if (!g.leavingMood) {
          const wasHappy =
            hadDeliveredRef.current.has(g.orderId) ||
            restaurantMotionStore.isDishPlaced(g.orderId);
          next.push({ ...g, leavingMood: wasHappy ? 'happy' : 'sad' });
        } else {
          next.push(g);
        }
      }

      // Add newly arrived orders
      const existingIds = new Set(next.map((g) => g.orderId));
      for (const o of orders) {
        if (existingIds.has(o.id)) continue;
        const ageMs = nowMs - new Date(o.createdAt).getTime();
        next.push({
          orderId: o.id,
          tableId: o.tableId,
          avatar: o.customerAvatar,
          name: o.customerName,
          // Already seated if order existed before page load (> 5s old)
          initialSeated: ageMs > 5000,
          leavingMood: null,
        });
      }

      return next;
    });
  }, [orders, clockOffsetMs]);

  const handleDespawn = (orderId: string) => {
    hadDeliveredRef.current.delete(orderId);
    setGuests((prev) => prev.filter((g) => g.orderId !== orderId));
  };

  return (
    <group>
      {guests.map((guest) => (
        <CustomerActor
          key={guest.orderId}
          guest={guest}
          order={orders.find((o) => o.id === guest.orderId)}
          navGrid={navGrid}
          active={active}
          onDespawn={handleDespawn}
        />
      ))}
    </group>
  );
}
