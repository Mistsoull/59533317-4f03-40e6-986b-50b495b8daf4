import { useState } from 'react';
import {
  BookOpen,
  Home,
  LogOut,
  Moon,
  ShoppingBag,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CHARACTERS } from '../../config/characters';
import type { RoomId } from '../../config/kitchenLayout';
import { PROFILES, type ProfileId } from '../../config/profiles';
import { RECIPE_LIST } from '../../config/recipes';
import { kitchenAudio } from '../../domain/audio';
import { needsPantrySupport } from '../../domain/stationRules';
import { useGameStore } from '../../store/useGameStore';
import { useSessionStore } from '../../store/useSessionStore';
import { useThemeStore } from '../../store/useThemeStore';

interface TopHudBarProps {
  profileId: ProfileId;
  onEnterRoom: (room: RoomId) => void;
  onSignOut: () => void;
}

export function TopHudBar({ profileId, onEnterRoom, onSignOut }: TopHudBarProps) {
  const coins = useGameStore((s) => s.coins);
  const currentRoom = useGameStore((s) => s.currentRoom);
  const inventory = useGameStore((s) => s.inventory);
  const profiles = useGameStore((s) => s.profiles);
  const recipes = useGameStore((s) => s.recipes);
  const setActiveOverlay = useGameStore((s) => s.setActiveOverlay);

  const onlineProfiles = useSessionStore((s) => s.onlineProfiles);
  const backendMode = useSessionStore((s) => s.backendMode);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const [muted, setMuted] = useState(() => kitchenAudio.isMuted());

  const partnerId: ProfileId = profileId === 'p1' ? 'p2' : 'p1';
  const partnerPresence = onlineProfiles[partnerId];
  const partnerOnline = Boolean(partnerPresence);

  const myProfile = profiles[profileId];
  const myChar = CHARACTERS[myProfile?.characterId ?? PROFILES[profileId].defaultCharacter];
  const myName = myProfile?.displayName ?? PROFILES[profileId].defaultName;

  const partnerName =
    partnerPresence?.displayName ??
    profiles[partnerId]?.displayName ??
    PROFILES[partnerId].defaultName;
  const partnerRoomLabel =
    partnerPresence?.room === 'market' ? 'Markette' : 'Mutfakta';

  const irlDoneCount = RECIPE_LIST.filter((r) => recipes[r.id]?.irlCookedCount > 0).length;
  const showSupportDot = needsPantrySupport(coins, inventory, RECIPE_LIST);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-center justify-between gap-2 safe-top safe-x">
      {/* Left status cluster */}
      <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
        {/* Coin Wallet */}
        <div className="ui-card flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-sm font-extrabold shadow-md backdrop-blur-md">
          <span aria-hidden="true">🪙</span>
          <span className="text-amber-600 dark:text-amber-300">{coins}</span>
        </div>

        {/* Active Room & Player + Partner Presence */}
        <div className="ui-card flex items-center gap-2 rounded-2xl px-3 py-1.5 text-xs shadow-md backdrop-blur-md">
          <span className="font-extrabold">
            {myChar.emoji} {myName}
          </span>
          <span className="opacity-30">|</span>
          <span
            className={
              partnerOnline
                ? 'font-bold text-emerald-600 dark:text-emerald-300'
                : 'ui-muted'
            }
          >
            {partnerOnline
              ? `● ${partnerName} (${partnerRoomLabel})`
              : `○ ${partnerName} çevrimdışı`}
          </span>
          {backendMode === 'local' && (
            <span className="ui-subtle rounded-md px-1.5 py-0.5 text-[10px] font-semibold">
              Yerel
            </span>
          )}
        </div>
      </div>

      {/* Right action cluster */}
      <div className="pointer-events-auto flex items-center gap-1.5">
        {/* Switch between Kitchen and 3D Market room */}
        <button
          type="button"
          onClick={() => {
            kitchenAudio.unlockSync();
            kitchenAudio.playTap();
            onEnterRoom(currentRoom === 'kitchen' ? 'market' : 'kitchen');
          }}
          className={`relative inline-flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-extrabold text-white shadow-md transition active:scale-95 ${
            currentRoom === 'kitchen'
              ? 'bg-emerald-600 hover:bg-emerald-500'
              : 'bg-[#e07a5f] hover:brightness-105'
          }`}
        >
          {currentRoom === 'kitchen' ? (
            <>
              <ShoppingBag className="h-4 w-4" aria-hidden="true" />
              <span>Markete Git</span>
            </>
          ) : (
            <>
              <Home className="h-4 w-4" aria-hidden="true" />
              <span>Mutfağa Dön</span>
            </>
          )}
          {showSupportDot && currentRoom === 'kitchen' && (
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-amber-300 ring-2 ring-white" />
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            kitchenAudio.unlockSync();
            kitchenAudio.playTap();
            setActiveOverlay('recipe_book');
          }}
          className="ui-card inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-extrabold shadow-md backdrop-blur-md transition active:scale-95"
        >
          <BookOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
          <span>Tarif Defteri</span>
          <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-200">
            {irlDoneCount}/3
          </span>
        </button>

        {/* Light / Dark Theme Toggle */}
        <button
          type="button"
          onClick={() => {
            kitchenAudio.unlockSync();
            kitchenAudio.playTap();
            toggleTheme();
          }}
          aria-label={theme === 'light' ? 'Koyu Temaya Geç' : 'Açık Temaya Geç'}
          className="ui-card inline-flex h-11 w-11 items-center justify-center rounded-2xl shadow-md backdrop-blur-md transition active:scale-95"
        >
          {theme === 'light' ? (
            <Moon className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Sun className="h-4 w-4 text-amber-300" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setMuted(kitchenAudio.toggleMute())}
          aria-label={muted ? 'Sesi Aç' : 'Sesi Kapat'}
          className="ui-card inline-flex h-11 w-11 items-center justify-center rounded-2xl shadow-md backdrop-blur-md transition active:scale-95"
        >
          {muted ? (
            <VolumeX className="h-4 w-4 ui-muted" aria-hidden="true" />
          ) : (
            <Volume2 className="h-4 w-4 text-amber-600 dark:text-amber-300" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          onClick={onSignOut}
          aria-label="Profil Değiştir"
          className="ui-card inline-flex h-11 w-11 items-center justify-center rounded-2xl shadow-md backdrop-blur-md transition active:scale-95 hover:text-rose-500"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
