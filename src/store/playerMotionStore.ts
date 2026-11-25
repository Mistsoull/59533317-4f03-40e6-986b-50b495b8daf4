import type { RoomId, StationId } from '../config/kitchenLayout';
import type { MarketStallId } from '../config/marketLayout';
import type { ProfileId } from '../config/profiles';
import type { Vec2 } from '../domain/collision2d';
import type { AnimState } from '../services/supabase/types';

export type PendingDestination =
  | null
  | { type: 'station'; stationId: StationId }
  | { type: 'market_stall'; stallId: MarketStallId }
  | { type: 'door'; targetRoom: RoomId };

export interface LocalMotionState {
  room: RoomId;
  x: number;
  z: number;
  rotY: number;
  anim: AnimState;
  waypoints: Vec2[];
  pendingDest: PendingDestination;
  facingGoal: number | null;
  targetMarker: { x: number; z: number; id: number } | null;
  stepTimer: number;
  isInteracting: boolean;
}

export interface RemoteMotionState {
  profileId: ProfileId | null;
  room: RoomId;
  active: boolean;
  initialized: boolean;
  x: number;
  z: number;
  rotY: number;
  targetX: number;
  targetZ: number;
  targetRotY: number;
  anim: AnimState;
  lastSeq: number;
  lastPacketAt: number;
}

let markerSeq = 0;

/**
 * Non-React mutable transient store updated at 60 FPS inside R3F useFrame.
 * Prevents frame-by-frame React state updates and keeps player movement silky-smooth.
 */
export const playerMotionStore: {
  local: LocalMotionState;
  remote: RemoteMotionState;
  resetLocal: (x: number, z: number, room?: RoomId) => void;
  setWalkTarget: (
    waypoints: Vec2[],
    marker: Vec2 | null,
    pendingDest: PendingDestination,
  ) => void;
  setLocalInteracting: (interacting: boolean, facingAngle?: number) => void;
  applyRemotePacket: (
    profileId: ProfileId,
    room: RoomId,
    x: number,
    z: number,
    rotY: number,
    anim: AnimState,
    seq: number,
  ) => void;
  setRemoteActive: (active: boolean, profileId?: ProfileId | null, room?: RoomId) => void;
} = {
  local: {
    room: 'kitchen',
    x: -1.4,
    z: -0.3,
    rotY: 0,
    anim: 'Idle',
    waypoints: [],
    pendingDest: null,
    facingGoal: null,
    targetMarker: null,
    stepTimer: 0,
    isInteracting: false,
  },
  remote: {
    profileId: null,
    room: 'kitchen',
    active: false,
    initialized: false,
    x: 1.4,
    z: -0.3,
    rotY: 0,
    targetX: 1.4,
    targetZ: -0.3,
    targetRotY: 0,
    anim: 'Idle',
    lastSeq: -1,
    lastPacketAt: 0,
  },

  resetLocal(x, z, room = 'kitchen') {
    this.local.room = room;
    this.local.x = x;
    this.local.z = z;
    this.local.rotY = 0;
    this.local.anim = 'Idle';
    this.local.waypoints = [];
    this.local.pendingDest = null;
    this.local.facingGoal = null;
    this.local.targetMarker = null;
    this.local.isInteracting = false;
  },

  setWalkTarget(waypoints, marker, pendingDest) {
    this.local.waypoints = waypoints;
    this.local.pendingDest = pendingDest;
    this.local.isInteracting = false;
    this.local.facingGoal = null;
    if (marker) {
      markerSeq += 1;
      this.local.targetMarker = { x: marker.x, z: marker.z, id: markerSeq };
    }
  },

  setLocalInteracting(interacting, facingAngle) {
    this.local.isInteracting = interacting;
    if (interacting) {
      this.local.waypoints = [];
      this.local.pendingDest = null;
      this.local.anim = 'Interact';
      if (facingAngle !== undefined) {
        this.local.facingGoal = facingAngle;
      }
    } else if (this.local.waypoints.length === 0) {
      this.local.anim = 'Idle';
    }
  },

  applyRemotePacket(profileId, room, x, z, rotY, anim, seq) {
    if (
      this.remote.profileId === profileId &&
      seq < this.remote.lastSeq &&
      this.remote.lastSeq - seq < 500
    ) {
      return;
    }

    const roomChanged = this.remote.room !== room;
    this.remote.profileId = profileId;
    this.remote.room = room;
    this.remote.active = true;
    this.remote.lastSeq = seq;
    this.remote.lastPacketAt = performance.now();
    this.remote.targetX = x;
    this.remote.targetZ = z;
    this.remote.targetRotY = rotY;
    this.remote.anim = anim;

    if (!this.remote.initialized || roomChanged) {
      this.remote.x = x;
      this.remote.z = z;
      this.remote.rotY = rotY;
      this.remote.initialized = true;
    }
  },

  setRemoteActive(active, profileId, room) {
    this.remote.active = active;
    if (profileId !== undefined) {
      this.remote.profileId = profileId;
    }
    if (room !== undefined) {
      this.remote.room = room;
    }
    if (!active) {
      this.remote.initialized = false;
      this.remote.lastSeq = -1;
      this.remote.anim = 'Idle';
    }
  },
};
