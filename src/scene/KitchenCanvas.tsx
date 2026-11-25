import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  GRID_CELL_SIZE,
  KITCHEN_BOUNDS,
  KITCHEN_OBSTACLES,
  KITCHEN_SERVICE_PASS,
  KITCHEN_STATIONS,
  KITCHEN_TO_MARKET_DOOR,
  KITCHEN_TO_RESTAURANT_DOOR,
  PLAYER_HALF_EXTENT,
  type RoomId,
  type StationId,
} from '../config/kitchenLayout';
import {
  MARKET_OBSTACLES,
  MARKET_STALLS,
  MARKET_STALL_LIST,
  MARKET_TO_KITCHEN_DOOR,
  type MarketStallId,
} from '../config/marketLayout';
import type { ProfileId } from '../config/profiles';
import {
  RESTAURANT_BOUNDS,
  RESTAURANT_OBSTACLES,
  RESTAURANT_SERVICE_PASS,
  RESTAURANT_TABLE_LIST,
  RESTAURANT_TO_KITCHEN_DOOR,
} from '../config/restaurantLayout';
import { kitchenAudio } from '../domain/audio';
import { buildNavGrid, findPath2D } from '../domain/pathfinding';
import { playerMotionStore, type PendingDestination } from '../store/playerMotionStore';
import { useGameStore } from '../store/useGameStore';
import { useThemeStore } from '../store/useThemeStore';
import { IsometricCamera } from './IsometricCamera';
import { KitchenRoom } from './KitchenRoom';
import { MarketRoom } from './MarketRoom';
import { RestaurantRoom } from './RestaurantRoom';
import { RoomDoor } from './RoomDoor';
import { TargetMarker } from './TargetMarker';
import { ModelSlot } from './assets/ModelSlot';
import {
  CuttingBoardPlaceholder,
  FridgePlaceholder,
  StovePlaceholder,
} from './assets/placeholders/StationPlaceholders';
import { LocalPlayer } from './entities/LocalPlayer';
import { RemotePlayer } from './entities/RemotePlayer';
import { RestaurantGuests } from './entities/RestaurantGuests';
import { WaiterNpc } from './entities/WaiterNpc';
import { MarketStallInteractable } from './stations/MarketStallInteractable';
import { RestaurantTableInteractable } from './stations/RestaurantTableInteractable';
import { ServicePassInteractable } from './stations/ServicePassInteractable';
import { StationInteractable } from './stations/StationInteractable';

interface KitchenCanvasProps {
  profileId: ProfileId;
  onArriveAtStation: (stationId: StationId) => void;
  onArriveAtMarketStall: (stallId: MarketStallId) => void;
  onArriveAtServicePass: () => void;
  onEnterRoom: (targetRoom: RoomId) => void;
}

export function KitchenCanvas({
  profileId,
  onArriveAtStation,
  onArriveAtMarketStall,
  onArriveAtServicePass,
  onEnterRoom,
}: KitchenCanvasProps) {
  const currentRoom = useGameStore((s) => s.currentRoom);
  const activeOverlay = useGameStore((s) => s.activeOverlay);
  const stoveStatus = useGameStore((s) => s.stations.stove.status);
  const stoveLocked = useGameStore((s) => Boolean(s.stations.stove.lockedBy));
  const theme = useThemeStore((s) => s.theme);

  const kitchenNavGrid = useMemo(
    () =>
      buildNavGrid(
        KITCHEN_BOUNDS,
        GRID_CELL_SIZE,
        PLAYER_HALF_EXTENT,
        KITCHEN_OBSTACLES,
      ),
    [],
  );

  const marketNavGrid = useMemo(
    () =>
      buildNavGrid(
        KITCHEN_BOUNDS,
        GRID_CELL_SIZE,
        PLAYER_HALF_EXTENT,
        MARKET_OBSTACLES,
      ),
    [],
  );

  const restaurantNavGrid = useMemo(
    () =>
      buildNavGrid(
        RESTAURANT_BOUNDS,
        GRID_CELL_SIZE,
        PLAYER_HALF_EXTENT,
        RESTAURANT_OBSTACLES,
      ),
    [],
  );

  const activeNavGrid =
    currentRoom === 'kitchen'
      ? kitchenNavGrid
      : currentRoom === 'market'
        ? marketNavGrid
        : restaurantNavGrid;

  const activeObstacles =
    currentRoom === 'kitchen'
      ? KITCHEN_OBSTACLES
      : currentRoom === 'market'
        ? MARKET_OBSTACLES
        : RESTAURANT_OBSTACLES;

  const walkTo = (
    gx: number,
    gz: number,
    pendingDest: PendingDestination,
    facingAngle?: number,
  ) => {
    if (activeOverlay !== null) return;
    kitchenAudio.unlockSync();
    kitchenAudio.playTap();

    const loc = playerMotionStore.local;
    if (pendingDest && Math.hypot(loc.x - gx, loc.z - gz) < 0.4) {
      if (facingAngle !== undefined) loc.facingGoal = facingAngle;
      handleArriveDestination(pendingDest);
      return;
    }

    const waypoints = findPath2D(
      activeNavGrid,
      { x: loc.x, z: loc.z },
      { x: gx, z: gz },
      PLAYER_HALF_EXTENT,
      activeObstacles,
    );
    if (waypoints.length > 0) {
      const markerPt = pendingDest ? { x: gx, z: gz } : waypoints[waypoints.length - 1];
      playerMotionStore.setWalkTarget(waypoints, markerPt, pendingDest);
    }
  };

  const handleArriveDestination = (dest: NonNullable<PendingDestination>) => {
    if (dest.type === 'station') {
      onArriveAtStation(dest.stationId);
    } else if (dest.type === 'market_stall') {
      onArriveAtMarketStall(dest.stallId);
    } else if (dest.type === 'service_pass') {
      onArriveAtServicePass();
    } else if (dest.type === 'door') {
      onEnterRoom(dest.targetRoom);
    }
  };

  const bgHex =
    theme === 'light'
      ? currentRoom === 'kitchen'
        ? '#f7efe3'
        : currentRoom === 'market'
          ? '#e8f4ec'
          : '#f4e8d8'
      : currentRoom === 'kitchen'
        ? '#1e1b18'
        : currentRoom === 'market'
          ? '#18201c'
          : '#211a15';

  const hemiIntensity = theme === 'light' ? 1.15 : 0.85;
  const sunIntensity = theme === 'light' ? 1.45 : 1.25;

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
      <color attach="background" args={[bgHex]} />
      <IsometricCamera room={currentRoom} />

      {/* Warm cozy mobile-friendly WebGL 2 lighting */}
      <hemisphereLight
        args={[
          theme === 'light' ? '#fffdf8' : '#fff5e4',
          theme === 'light' ? '#d9c2a8' : '#5c4b3f',
          hemiIntensity,
        ]}
      />
      <directionalLight
        position={[7, 12, 8]}
        intensity={sunIntensity}
        color="#fff4e0"
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
      <directionalLight position={[-6, 6, -4]} intensity={0.4} color="#d6ecff" />

      <TargetMarker />

      {/* Keep all 3 rooms mounted via visibility for instant (<1ms) switching & uninterrupted Waiter/Customer animations */}
      <group visible={currentRoom === 'kitchen'}>
        <KitchenRoom
          onTapFloor={(x, z) => {
            if (currentRoom === 'kitchen') walkTo(x, z, null);
          }}
        />

        <StationInteractable
          stationId="cutting_board"
          myProfileId={profileId}
          active={currentRoom === 'kitchen'}
          onSelectStation={(id) => {
            const d = KITCHEN_STATIONS[id];
            walkTo(d.interactionPoint[0], d.interactionPoint[1], { type: 'station', stationId: id }, d.facingAngle);
          }}
        >
          <ModelSlot assetId="station_cutting_board" placeholder={<CuttingBoardPlaceholder />} />
        </StationInteractable>

        <StationInteractable
          stationId="stove"
          myProfileId={profileId}
          active={currentRoom === 'kitchen'}
          onSelectStation={(id) => {
            const d = KITCHEN_STATIONS[id];
            walkTo(d.interactionPoint[0], d.interactionPoint[1], { type: 'station', stationId: id }, d.facingAngle);
          }}
        >
          <ModelSlot
            assetId="station_stove"
            placeholder={<StovePlaceholder isActive={stoveLocked || stoveStatus === 'ready'} />}
          />
        </StationInteractable>

        <StationInteractable
          stationId="fridge"
          myProfileId={profileId}
          active={currentRoom === 'kitchen'}
          onSelectStation={(id) => {
            const d = KITCHEN_STATIONS[id];
            walkTo(d.interactionPoint[0], d.interactionPoint[1], { type: 'station', stationId: id }, d.facingAngle);
          }}
        >
          <ModelSlot assetId="station_fridge" placeholder={<FridgePlaceholder />} />
        </StationInteractable>

        {/* Kitchen-side Service Pass & Bell (clear of Fridge and Restaurant Door) */}
        <ServicePassInteractable
          position={KITCHEN_SERVICE_PASS.position}
          interactionPoint={KITCHEN_SERVICE_PASS.interactionPoint}
          active={currentRoom === 'kitchen'}
          onSelectPass={() =>
            walkTo(
              KITCHEN_SERVICE_PASS.interactionPoint[0],
              KITCHEN_SERVICE_PASS.interactionPoint[1],
              { type: 'service_pass' },
              KITCHEN_SERVICE_PASS.facingAngle,
            )
          }
        />

        <RoomDoor
          door={KITCHEN_TO_MARKET_DOOR}
          accentColor="#52b788"
          active={currentRoom === 'kitchen'}
          onSelectDoor={() =>
            walkTo(
              KITCHEN_TO_MARKET_DOOR.interactionPoint[0],
              KITCHEN_TO_MARKET_DOOR.interactionPoint[1],
              { type: 'door', targetRoom: 'market' },
              KITCHEN_TO_MARKET_DOOR.facingAngle,
            )
          }
        />

        <RoomDoor
          door={KITCHEN_TO_RESTAURANT_DOOR}
          accentColor="#d97706"
          wall="right"
          active={currentRoom === 'kitchen'}
          onSelectDoor={() =>
            walkTo(
              KITCHEN_TO_RESTAURANT_DOOR.interactionPoint[0],
              KITCHEN_TO_RESTAURANT_DOOR.interactionPoint[1],
              { type: 'door', targetRoom: 'restaurant' },
              KITCHEN_TO_RESTAURANT_DOOR.facingAngle,
            )
          }
        />
      </group>

      <group visible={currentRoom === 'market'}>
        <MarketRoom
          onTapFloor={(x, z) => {
            if (currentRoom === 'market') walkTo(x, z, null);
          }}
        />

        {MARKET_STALL_LIST.map((stall) => (
          <MarketStallInteractable
            key={stall.id}
            stallId={stall.id}
            active={currentRoom === 'market'}
            onSelectStall={(id) => {
              const d = MARKET_STALLS[id];
              walkTo(
                d.interactionPoint[0],
                d.interactionPoint[1],
                { type: 'market_stall', stallId: id },
                d.facingAngle,
              );
            }}
          />
        ))}

        <RoomDoor
          door={MARKET_TO_KITCHEN_DOOR}
          accentColor="#e07a5f"
          wall="back"
          active={currentRoom === 'market'}
          onSelectDoor={() =>
            walkTo(
              MARKET_TO_KITCHEN_DOOR.interactionPoint[0],
              MARKET_TO_KITCHEN_DOOR.interactionPoint[1],
              { type: 'door', targetRoom: 'kitchen' },
              MARKET_TO_KITCHEN_DOOR.facingAngle,
            )
          }
        />
      </group>

      <group visible={currentRoom === 'restaurant'}>
        <RestaurantRoom
          onTapFloor={(x, z) => {
            if (currentRoom === 'restaurant') walkTo(x, z, null);
          }}
        />

        {RESTAURANT_TABLE_LIST.map((table) => (
          <RestaurantTableInteractable
            key={table.id}
            table={table}
            active={currentRoom === 'restaurant'}
          />
        ))}

        <ServicePassInteractable
          position={RESTAURANT_SERVICE_PASS.position}
          interactionPoint={RESTAURANT_SERVICE_PASS.interactionPoint}
          active={currentRoom === 'restaurant'}
          onSelectPass={() =>
            walkTo(
              RESTAURANT_SERVICE_PASS.interactionPoint[0],
              RESTAURANT_SERVICE_PASS.interactionPoint[1],
              { type: 'service_pass' },
              RESTAURANT_SERVICE_PASS.facingAngle,
            )
          }
        />

        {/* Automatic 3D Waiter NPC & Walking Customer NPCs */}
        <WaiterNpc navGrid={restaurantNavGrid} active={currentRoom === 'restaurant'} />
        <RestaurantGuests navGrid={restaurantNavGrid} active={currentRoom === 'restaurant'} />

        <RoomDoor
          door={RESTAURANT_TO_KITCHEN_DOOR}
          accentColor="#e07a5f"
          wall="left"
          active={currentRoom === 'restaurant'}
          onSelectDoor={() =>
            walkTo(
              RESTAURANT_TO_KITCHEN_DOOR.interactionPoint[0],
              RESTAURANT_TO_KITCHEN_DOOR.interactionPoint[1],
              { type: 'door', targetRoom: 'kitchen' },
              RESTAURANT_TO_KITCHEN_DOOR.facingAngle,
            )
          }
        />
      </group>

      {/* Local & Remote Players */}
      <LocalPlayer
        profileId={profileId}
        room={currentRoom}
        obstacles={activeObstacles}
        onArriveDestination={handleArriveDestination}
      />
      <RemotePlayer myProfileId={profileId} room={currentRoom} />
    </Canvas>
  );
}
