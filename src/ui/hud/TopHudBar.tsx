import { useState } from 'react';
import { BookOpen, LogOut, ShoppingBag, Volume2, VolumeX } from 'lucide-react';
import { PROFILES, type ProfileId } from '../../config/profiles';
import { RECIPE_LIST } from '../../config/recipes';
import { kitchenAudio } from '../../domain/audio';
import { needsPantrySupport } from '../../domain/stationRules';
import { useGameStore } from '../../store/useGameStore';
import { useSessionStore } from '../../store/useSessionStore';

interface TopHudBarProps {
  profileId: ProfileId;
  onSignOut: () => void;
}

export function TopHudBar({ profileId, onSignOut }: TopHudBarProps) {
  const coins = useGameStore((s) => s.coins);
  const inventory = useGameStore((s) => s.inventory);
  const profiles = useGameStore((s) => s.profiles);
  const recipes = useGameStore((s) => s.recipes);
  const setActiveOverlay = useGameStore((s) => s.setActiveOverlay);

  const onlineProfiles = useSessionStore((s) => s.onlineProfiles);
  const backendMode = useSessionStore((s) => s.backendMode);

  const [muted, setMuted] = useState(() => kitchenAudio.isMuted());

  const partnerId: ProfileId = profileId === 'p1' ? 'p2' : 'p1';
  const partnerOnline = Boolean(onlineProfiles[partnerId]);
  const myName = profiles[profileId]?.displayName ?? PROFILES[profileId].defaultName;
  const partnerName = profiles[partnerId]?.displayName ?? PROFILES[partnerId].defaultName;

  const irlDoneCount = RECIPE_LIST.filter((r) => recipes[r.id]?.irlCookedCount > 0).length;
  const showSupportDot = needsPantrySupport(coins, inventory, RECIPE_LIST);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-center justify-between gap-2 safe-top safe-x">
      {/* Left status cluster */}
      <div className="pointer-events-auto flex flex-wrap items-center gap-2">
        {/* Coin Wallet */}
        <div className="flex items-center gap-1.5 rounded-2xl border border-amber-300/30 bg-stone-950/80 px-3 py-1.5 text-sm font-extrabold text-amber-300 shadow-lg backdrop-blur-md">
          <span aria-hidden="true">🪙</span>
          <span>{coins}</span>
        </div>

        {/* Active Chef + Partner Presence */}
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-stone-950/75 px-3 py-1.5 text-xs shadow-lg backdrop-blur-md">
          <span className="flex items-center gap-1.5 font-semibold text-amber-50">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: PROFILES[profileId].avatarColor }}
              aria-hidden="true"
            />
            {myName}
          </span>
          <span className="text-stone-600">|</span>
          <span className={partnerOnline ? 'font-semibold text-emerald-300' : 'text-stone-400'}>
            {partnerOnline ? `● ${partnerName} burada` : `○ ${partnerName} çevrimdışı`}
          </span>
          {backendMode === 'local' && (
            <span className="rounded-md bg-stone-800 px-1.5 py-0.5 text-[10px] text-stone-400">
              Yerel
            </span>
          )}
        </div>
      </div>

      {/* Right action cluster */}
      <div className="pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            kitchenAudio.unlockSync();
            kitchenAudio.playTap();
            setActiveOverlay('market');
          }}
          className="relative inline-flex items-center gap-1.5 rounded-2xl border border-amber-300/25 bg-stone-950/80 px-3.5 py-2 text-xs font-bold text-amber-100 shadow-lg backdrop-blur-md transition active:scale-95 hover:bg-stone-900"
        >
          <ShoppingBag className="h-4 w-4 text-amber-300" aria-hidden="true" />
          <span>Market</span>
          {showSupportDot && (
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-stone-950" />
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            kitchenAudio.unlockSync();
            kitchenAudio.playTap();
            setActiveOverlay('recipe_book');
          }}
          className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-300/25 bg-stone-950/80 px-3.5 py-2 text-xs font-bold text-emerald-100 shadow-lg backdrop-blur-md transition active:scale-95 hover:bg-stone-900"
        >
          <BookOpen className="h-4 w-4 text-emerald-300" aria-hidden="true" />
          <span>Tarif Defteri</span>
          <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-200">
            {irlDoneCount}/3
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMuted(kitchenAudio.toggleMute())}
          aria-label={muted ? 'Sesi Aç' : 'Sesi Kapat'}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-stone-950/80 text-stone-200 shadow-lg backdrop-blur-md transition active:scale-95"
        >
          {muted ? (
            <VolumeX className="h-4 w-4 text-stone-400" aria-hidden="true" />
          ) : (
            <Volume2 className="h-4 w-4 text-amber-200" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          onClick={onSignOut}
          aria-label="Profil Değiştir"
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-stone-950/80 text-stone-300 shadow-lg backdrop-blur-md transition active:scale-95 hover:text-rose-300"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
