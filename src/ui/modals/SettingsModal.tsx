import { useEffect, useState } from 'react';
import {
  BookOpen,
  Languages,
  LogOut,
  Maximize2,
  Minimize2,
  Moon,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { kitchenAudio } from '../../domain/audio';
import {
  isFullscreenActive,
  isFullscreenSupported,
  toggleFullscreen,
} from '../../domain/fullscreen';
import { getTranslations } from '../../i18n/translations';
import { useLanguageStore } from '../../store/useLanguageStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useThemeStore } from '../../store/useThemeStore';
import { ModalDialog } from '../common/ModalDialog';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onSignOut: () => void;
}

/**
 * Centered settings popup housing Language (TR/DE), Theme (Light/Dark),
 * Fullscreen toggle (hides Android notification bar), Sound, Real-life Recipes, and Sign Out.
 */
export function SettingsModal({ open, onClose, onSignOut }: SettingsModalProps) {
  const lang = useLanguageStore((s) => s.lang);
  const setLang = useLanguageStore((s) => s.setLang);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const showRealLifeRecipes = useSettingsStore((s) => s.showRealLifeRecipes);
  const toggleRealLifeRecipes = useSettingsStore((s) => s.toggleRealLifeRecipes);
  const [muted, setMuted] = useState(() => kitchenAudio.isMuted());
  const [fullscreen, setFullscreen] = useState(() => isFullscreenActive());
  const canFullscreen = isFullscreenSupported();

  const t = getTranslations(lang);

  useEffect(() => {
    const syncFs = () => setFullscreen(isFullscreenActive());
    document.addEventListener('fullscreenchange', syncFs);
    document.addEventListener('webkitfullscreenchange', syncFs);
    return () => {
      document.removeEventListener('fullscreenchange', syncFs);
      document.removeEventListener('webkitfullscreenchange', syncFs);
    };
  }, []);

  const handleToggleFullscreen = async () => {
    kitchenAudio.unlockSync();
    kitchenAudio.playTap();
    const active = await toggleFullscreen();
    setFullscreen(active);
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      compact
      icon="⚙️"
      title={t.settingsTitle}
      subtitle={t.settingsSubtitle}
    >
      <div className="space-y-2.5">
        {/* Language Selection: TR / DE */}
        <section className="ui-surface rounded-2xl p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-extrabold ui-muted">
            <Languages className="h-4 w-4 text-[#e07a5f]" aria-hidden="true" />
            <span>{t.languageLabel}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                kitchenAudio.unlockSync();
                kitchenAudio.playTap();
                setLang('tr');
              }}
              className={`rounded-xl py-2 text-xs font-extrabold transition active:scale-95 ${
                lang === 'tr'
                  ? 'bg-[#e07a5f] text-white shadow-sm'
                  : 'ui-subtle hover:brightness-95'
              }`}
            >
              🇹🇷 Türkçe
            </button>
            <button
              type="button"
              onClick={() => {
                kitchenAudio.unlockSync();
                kitchenAudio.playTap();
                setLang('de');
              }}
              className={`rounded-xl py-2 text-xs font-extrabold transition active:scale-95 ${
                lang === 'de'
                  ? 'bg-[#e07a5f] text-white shadow-sm'
                  : 'ui-subtle hover:brightness-95'
              }`}
            >
              🇩🇪 Deutsch
            </button>
          </div>
        </section>

        {/* Theme Selection: Light / Night Mode */}
        <section className="ui-surface rounded-2xl p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-extrabold ui-muted">
            {theme === 'light' ? (
              <Sun className="h-4 w-4 text-amber-500" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4 text-amber-300" aria-hidden="true" />
            )}
            <span>{t.themeLabel}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                kitchenAudio.unlockSync();
                kitchenAudio.playTap();
                setTheme('light');
              }}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-extrabold transition active:scale-95 ${
                theme === 'light'
                  ? 'bg-amber-500 text-stone-950 shadow-sm'
                  : 'ui-subtle hover:brightness-95'
              }`}
            >
              <Sun className="h-4 w-4" aria-hidden="true" />
              <span>{t.lightTheme}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                kitchenAudio.unlockSync();
                kitchenAudio.playTap();
                setTheme('dark');
              }}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-extrabold transition active:scale-95 ${
                theme === 'dark'
                  ? 'bg-stone-800 text-amber-200 ring-2 ring-amber-400/50 shadow-sm'
                  : 'ui-subtle hover:brightness-95'
              }`}
            >
              <Moon className="h-4 w-4" aria-hidden="true" />
              <span>{t.darkTheme}</span>
            </button>
          </div>
        </section>

        {/* Fullscreen Mode (hides Android status/notification bar in Chrome & PWA) */}
        {canFullscreen && (
          <section className="ui-surface flex items-center justify-between gap-3 rounded-2xl p-3">
            <div className="flex items-center gap-2 text-xs font-extrabold">
              {fullscreen ? (
                <Minimize2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
              ) : (
                <Maximize2 className="h-4 w-4 text-[#e07a5f]" aria-hidden="true" />
              )}
              <span>{t.fullscreenLabel}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={fullscreen}
              onClick={() => void handleToggleFullscreen()}
              className={`rounded-xl px-4 py-2 text-xs font-extrabold transition active:scale-95 ${
                fullscreen
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-[#e07a5f] text-white shadow-sm'
              }`}
            >
              {fullscreen ? t.fullscreenExit : t.fullscreenEnter}
            </button>
          </section>
        )}

        {/* Sound Toggle */}
        <section className="ui-surface flex items-center justify-between gap-3 rounded-2xl p-3">
          <div className="flex items-center gap-2 text-xs font-extrabold">
            {muted ? (
              <VolumeX className="h-4 w-4 ui-muted" aria-hidden="true" />
            ) : (
              <Volume2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
            )}
            <span>{t.soundLabel}</span>
          </div>
          <button
            type="button"
            onClick={() => setMuted(kitchenAudio.toggleMute())}
            className={`rounded-xl px-4 py-2 text-xs font-extrabold transition active:scale-95 ${
              muted ? 'ui-subtle ui-muted' : 'bg-emerald-600 text-white shadow-sm'
            }`}
          >
            {muted ? t.soundOff : t.soundOn}
          </button>
        </section>

        {/* Real-Life Recipes Toggle */}
        <section className="ui-surface flex items-center justify-between gap-3 rounded-2xl p-3">
          <div className="flex items-center gap-2 text-xs font-extrabold">
            <BookOpen
              className={`h-4 w-4 ${showRealLifeRecipes ? 'text-[#e07a5f]' : 'ui-muted'}`}
              aria-hidden="true"
            />
            <span>{t.realLifeRecipesLabel}</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={showRealLifeRecipes}
            onClick={() => {
              kitchenAudio.unlockSync();
              kitchenAudio.playTap();
              toggleRealLifeRecipes();
            }}
            className={`rounded-xl px-4 py-2 text-xs font-extrabold transition active:scale-95 ${
              showRealLifeRecipes
                ? 'bg-[#e07a5f] text-white shadow-sm'
                : 'ui-subtle ui-muted'
            }`}
          >
            {showRealLifeRecipes ? t.enabledLabel : t.disabledLabel}
          </button>
        </section>

        {/* Sign Out / Switch Profile */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onSignOut();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/12 py-3 text-xs font-extrabold text-rose-600 transition active:scale-95 hover:bg-rose-500/20 dark:text-rose-300"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span>{t.signOutBtn}</span>
        </button>
      </div>
    </ModalDialog>
  );
}
