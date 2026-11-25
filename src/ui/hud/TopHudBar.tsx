import { BookOpen, Settings } from 'lucide-react';
import { CHARACTERS } from '../../config/characters';
import { PROFILES, type ProfileId } from '../../config/profiles';
import { RECIPE_LIST } from '../../config/recipes';
import { kitchenAudio } from '../../domain/audio';
import { getTranslations } from '../../i18n/translations';
import { useGameStore } from '../../store/useGameStore';
import { useLanguageStore } from '../../store/useLanguageStore';
import { useSessionStore } from '../../store/useSessionStore';

interface TopHudBarProps {
  profileId: ProfileId;
}

/**
 * Clean minimal landscape HUD:
 * - Left: Coins + Player & Partner online/offline indicator (no room location text)
 * - Right: Recipe Book + single Settings gear button (opening centered SettingsModal)
 * - No warp-to-Market button (travel only by walking through the 3D door)
 */
export function TopHudBar({ profileId }: TopHudBarProps) {
  const coins = useGameStore((s) => s.coins);
  const profiles = useGameStore((s) => s.profiles);
  const recipes = useGameStore((s) => s.recipes);
  const setActiveOverlay = useGameStore((s) => s.setActiveOverlay);

  const onlineProfiles = useSessionStore((s) => s.onlineProfiles);
  const backendMode = useSessionStore((s) => s.backendMode);
  const lang = useLanguageStore((s) => s.lang);
  const t = getTranslations(lang);

  const partnerId: ProfileId = profileId === 'p1' ? 'p2' : 'p1';
  const partnerPresence = onlineProfiles[partnerId];
  const partnerOnline = Boolean(partnerPresence);

  const myProfile = profiles[profileId];
  const myChar = CHARACTERS[myProfile?.characterId ?? PROFILES[profileId].defaultCharacter];
  const myName = myProfile?.displayName ?? PROFILES[profileId].defaultName;

  const partnerName =
    profiles[partnerId]?.displayName ??
    partnerPresence?.displayName ??
    PROFILES[partnerId].defaultName;

  const irlDoneCount = RECIPE_LIST.filter((r) => recipes[r.id]?.irlCookedCount > 0).length;

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-center justify-between gap-2 safe-top safe-x">
      {/* Left status cluster */}
      <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
        <div className="ui-card flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-sm font-extrabold shadow-md backdrop-blur-md">
          <span aria-hidden="true">🪙</span>
          <span className="text-amber-600 dark:text-amber-300">{coins}</span>
        </div>

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
              ? `● ${partnerName} ${t.online}`
              : `○ ${partnerName} ${t.offline}`}
          </span>
          {backendMode === 'local' && (
            <span className="ui-subtle rounded-md px-1.5 py-0.5 text-[10px] font-semibold">
              {t.localTag}
            </span>
          )}
        </div>
      </div>

      {/* Right minimal action cluster: Recipe Book + Settings */}
      <div className="pointer-events-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            kitchenAudio.unlockSync();
            kitchenAudio.playTap();
            setActiveOverlay('recipe_book');
          }}
          className="ui-card inline-flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-extrabold shadow-md backdrop-blur-md transition active:scale-95"
        >
          <BookOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
          <span>{t.recipeBook}</span>
          <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-200">
            {irlDoneCount}/3
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            kitchenAudio.unlockSync();
            kitchenAudio.playTap();
            setActiveOverlay('settings');
          }}
          aria-label={t.settingsAria}
          className="ui-card inline-flex h-11 w-11 items-center justify-center rounded-2xl shadow-md backdrop-blur-md transition active:scale-95"
        >
          <Settings className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
