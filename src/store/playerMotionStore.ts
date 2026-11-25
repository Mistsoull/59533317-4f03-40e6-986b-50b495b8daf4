import type { StationId } from '../config/kitchenLayout';
import type { ProfileId } from '../config/profiles';
import type { Vec2 } from '../domain/collision2d';
import type { AnimState } from '../services/supabase/types';

export interface LocalMotionState {
  x: number;
  z: number;
  rotY: number;
  anim: AnimState;
  waypoints: Vec2[];
  pendingStation: StationId | null;
  facingGoal: number | null;
  targetMarker: { x: number; z: number; id: number } | null;
  stepTimer: number;
  isInteracting: boolean;
}

export interface RemoteMotionState {
  profileId: ProfileId | null;
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
  resetLocal: (x: number, z: number) => void;
  setWalkTarget: (waypoints: Vec2[], marker: Vec2 | null, pendingStation: StationId | null) => void;
  setLocalInteracting: (interacting: boolean, facingAngle?: number) => void;
  applyRemotePacket: (
    profileId: ProfileId,
    x: number,
    z: number,
    rotY: number,
    anim: AnimState,
    seq: number,
  ) => void;
  setRemoteActive: (active: boolean, profileId?: ProfileId | null) => void;
} = {
  local: {
    x: -1.4,
    z: -0.3,
    rotY: 0,
    anim: 'Idle',
    waypoints: [],
    pendingStation: null,
    facingGoal: null,
    targetMarker: null,
    stepTimer: 0,
    isInteracting: false,
  },
  remote: {
    profileId: null,
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

  resetLocal(x, z) {
    this.local.x = x;
    this.local.z = z;
    this.local.rotY = 0;
    this.local.anim = 'Idle';
    this.local.waypoints = [];
    this.local.pendingStation = null;
    this.local.facingGoal = null;
    this.local.targetMarker = null;
    this.local.isInteracting = false;
  },

  setWalkTarget(waypoints, marker, pendingStation) {
    this.local.waypoints = waypoints;
    this.local.pendingStation = pendingStation;
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
      this.local.pendingStation = null;
      this.local.anim = 'Interact';
      if (facingAngle !== undefined) {
        this.local.facingGoal = facingAngle;
      }
    } else if (this.local.waypoints.length === 0) {
      this.local.anim = 'Idle';
    }
  },

  applyRemotePacket(profileId, x, z, rotY, anim, seq) {
    // Ignore stale out-of-order packets unless sequence wrapped/restarted
    if (
      this.remote.profileId === profileId &&
      seq < this.remote.lastSeq &&
      this.remote.lastSeq - seq < 500
    ) {
      return;
    }

    this.remote.profileId = profileId;
    this.remote.active = true;
    this.remote.lastSeq = seq;
    this.remote.lastPacketAt = performance.now();
    this.remote.targetX = x;
    this.remote.targetZ = z;
    this.remote.targetRotY = rotY;
    this.remote.anim = anim;

    if (!this.remote.initialized) {
      this.remote.x = x;
      this.remote.z = z;
      this.remote.rotY = rotY;
      this.remote.initialized = true;
    }
  },

  setRemoteActive(active, profileId) {
    this.remote.active = active;
    if (profileId !== undefined) {
      this.remote.profileId = profileId;
    }
    if (!active) {
      this.remote.initialized = false;
      this.remote.lastSeq = -1;
      this.remote.anim = 'Idle';
    }
  },
};
