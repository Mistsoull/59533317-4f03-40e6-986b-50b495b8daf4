import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  GRID_CELL_SIZE,
  KITCHEN_BOUNDS,
  KITCHEN_OBSTACLES,
  KITCHEN_STATIONS,
  PLAYER_HALF_EXTENT,
  type StationId,
} from '../config/kitchenLayout';
import type { ProfileId } from '../config/profiles';
import { kitchenAudio } from '../domain/audio';
import { buildNavGrid, findPath2D } from '../domain/pathfinding';
import { playerMotionStore } from '../store/playerMotionStore';
import { useGameStore } from '../store/useGameStore';
import { IsometricCamera } from './IsometricCamera';
import { KitchenRoom } from './KitchenRoom';
import { TargetMarker } from './TargetMarker';
import { ModelSlot } from './assets/ModelSlot';
import {
  CuttingBoardPlaceholder,
  FridgePlaceholder,
  StovePlaceholder,
} from './assets/placeholders/StationPlaceholders';
import { LocalPlayer } from './entities/LocalPlayer';
import { RemotePlayer } from './entities/RemotePlayer';
import { StationInteractable } from './stations/StationInteractable';

interface KitchenCanvasProps {
  profileId: ProfileId;
  onArriveAtStation: (stationId: StationId) => void;
}

export function KitchenCanvas({ profileId, onArriveAtStation }: KitchenCanvasProps) {
  const activeOverlay = useGameStore((s) => s.activeOverlay);
  const stoveStatus = useGameStore((s) => s.stations.stove.status);
  const stoveLocked = useGameStore((s) => Boolean(s.stations.stove.lockedBy));

  const navGrid = useMemo(
    () =>
      buildNavGrid(
        KITCHEN_BOUNDS,
        GRID_CELL_SIZE,
        PLAYER_HALF_EXTENT,
        KITCHEN_OBSTACLES,
      ),
    [],
  );

  const handleTapFloor = (x: number, z: number) => {
    if (activeOverlay !== null) return;
    kitchenAudio.unlockSync();
    kitchenAudio.playTap();

    const loc = playerMotionStore.local;
    const waypoints = findPath2D(
      navGrid,
      { x: loc.x, z: loc.z },
      { x, z },
      PLAYER_HALF_EXTENT,
      KITCHEN_OBSTACLES,
    );
    if (waypoints.length > 0) {
      const finalPt = waypoints[waypoints.length - 1];
      playerMotionStore.setWalkTarget(waypoints, finalPt, null);
    }
  };

  const handleSelectStation = (stationId: StationId) => {
    if (activeOverlay !== null) return;
    kitchenAudio.unlockSync();
    kitchenAudio.playTap();

    const def = KITCHEN_STATIONS[stationId];
    const [gx, gz] = def.interactionPoint;
    const loc = playerMotionStore.local;

    // Already standing right in front of this station
    if (Math.hypot(loc.x - gx, loc.z - gz) < 0.35) {
      loc.facingGoal = def.facingAngle;
      onArriveAtStation(stationId);
      return;
    }

    const waypoints = findPath2D(
      navGrid,
      { x: loc.x, z: loc.z },
      { x: gx, z: gz },
      PLAYER_HALF_EXTENT,
      KITCHEN_OBSTACLES,
    );
    if (waypoints.length > 0) {
      playerMotionStore.setWalkTarget(waypoints, { x: gx, z: gz }, stationId);
    }
  };

  return (
    <Canvas
      dpr={[1, 2]}
      shadows
      gl={{
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
      }}
      style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
    >
      <color attach="background" args={['#1e1b18']} />
      <IsometricCamera />

      {/* Warm cozy mobile-friendly lighting (no heavy post-processing) */}
      <hemisphereLight args={['#fff5e4', '#5c4b3f', 0.85]} />
      <directionalLight
        position={[7, 12, 8]}
        intensity={1.35}
        color="#fff2dc"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-6, 6, -4]} intensity={0.35} color="#cfe8ff" />

      <KitchenRoom onTapFloor={handleTapFloor} />
      <TargetMarker />

      {/* 3 Interactive Stations */}
      <StationInteractable
        stationId="fridge"
        myProfileId={profileId}
        onSelectStation={handleSelectStation}
      >
        <ModelSlot assetId="station_fridge" placeholder={<FridgePlaceholder />} />
      </StationInteractable>

      <StationInteractable
        stationId="cutting_board"
        myProfileId={profileId}
        onSelectStation={handleSelectStation}
      >
        <ModelSlot
          assetId="station_cutting_board"
          placeholder={<CuttingBoardPlaceholder />}
        />
      </StationInteractable>

      <StationInteractable
        stationId="stove"
        myProfileId={profileId}
        onSelectStation={handleSelectStation}
      >
        <ModelSlot
          assetId="station_stove"
          placeholder={
            <StovePlaceholder isActive={stoveLocked || stoveStatus === 'ready'} />
          }
        />
      </StationInteractable>

      {/* Local & Remote Chefs */}
      <LocalPlayer profileId={profileId} onArriveAtStation={onArriveAtStation} />
      <RemotePlayer myProfileId={profileId} />
    </Canvas>
  );
}
