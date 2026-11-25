import { useState, type FormEvent } from 'react';
import { Cloud, HardDrive, Lock, Moon, Settings2, Sun, User } from 'lucide-react';
import { CHARACTER_LIST, type CharacterId } from '../../config/characters';
import {
  DEFAULT_LOCAL_PIN,
  PROFILES,
  PROFILE_LIST,
  type ProfileId,
} from '../../config/profiles';
import { kitchenAudio } from '../../domain/audio';
import { getTranslations } from '../../i18n/translations';
import { signInWithProfilePin } from '../../services/supabase/auth';
import {
  getSupabaseConfig,
  isSupabaseConfigured,
  saveSupabaseRuntimeConfig,
} from '../../services/supabase/client';
import { updateMyProfile } from '../../services/supabase/homeRepository';
import { useLanguageStore } from '../../store/useLanguageStore';
import type { BackendMode } from '../../store/useSessionStore';
import { useThemeStore } from '../../store/useThemeStore';

interface ProfilePinGateProps {
  onSignedIn: (profileId: ProfileId, mode: BackendMode) => void;
}

const LAST_NAME_PREFIX = 'cozy_kitchen_custom_name_';
const LAST_CHAR_PREFIX = 'cozy_kitchen_custom_char_';

function readSavedName(pid: ProfileId): string {
  try {
    return localStorage.getItem(LAST_NAME_PREFIX + pid) || PROFILES[pid].defaultName;
  } catch {
    return PROFILES[pid].defaultName;
  }
}

function readSavedChar(pid: ProfileId): CharacterId {
  try {
    const c = localStorage.getItem(LAST_CHAR_PREFIX + pid);
    if (c === 'cat' || c === 'dog' || c === 'bubu' || c === 'dudu') return c;
  } catch {
    // ignore
  }
  return PROFILES[pid].defaultCharacter;
}

export function ProfilePinGate({ onSignedIn }: ProfilePinGateProps) {
  const [selectedProfile, setSelectedProfile] = useState<ProfileId>('p1');
  const [customName, setCustomName] = useState<string>(() => readSavedName('p1'));
  const [selectedChar, setSelectedChar] = useState<CharacterId>(() => readSavedChar('p1'));
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const lang = useLanguageStore((s) => s.lang);
  const setLang = useLanguageStore((s) => s.setLang);
  const t = getTranslations(lang);

  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const [showSetup, setShowSetup] = useState(false);
  const existingCfg = getSupabaseConfig();
  const [supaUrl, setSupaUrl] = useState(existingCfg?.url ?? '');
  const [supaAnon, setSupaAnon] = useState(existingCfg?.anonKey ?? '');
  const [supabaseReady, setSupabaseReady] = useState(isSupabaseConfigured);

  const handleSelectSlot = (pid: ProfileId) => {
    kitchenAudio.unlockSync();
    kitchenAudio.playTap();
    setSelectedProfile(pid);
    setCustomName(readSavedName(pid));
    setSelectedChar(readSavedChar(pid));
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    kitchenAudio.unlockSync();
    setError(null);
    setSubmitting(true);

    const res = await signInWithProfilePin(selectedProfile, pin);
    if (!res.ok || !res.profileId) {
      setSubmitting(false);
      kitchenAudio.playError();
      setError(res.error ?? 'Giriş yapılamadı.');
      return;
    }

    const finalName = customName.trim().slice(0, 20) || PROFILES[res.profileId].defaultName;
    try {
      localStorage.setItem(LAST_NAME_PREFIX + res.profileId, finalName);
      localStorage.setItem(LAST_CHAR_PREFIX + res.profileId, selectedChar);
    } catch {
      // ignore
    }

    await updateMyProfile(res.profileId, finalName, selectedChar);
    setSubmitting(false);
    kitchenAudio.playSuccess();
    onSignedIn(res.profileId, res.backendMode);
  };

  const handlePadPress = (digit: string) => {
    kitchenAudio.unlockSync();
    kitchenAudio.playTap();
    setError(null);
    if (digit === 'DEL') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length < 6) {
      setPin((p) => p + digit);
    }
  };

  const handleSaveSupabase = (e: FormEvent) => {
    e.preventDefault();
    if (!supaUrl.trim() || !supaAnon.trim()) {
      saveSupabaseRuntimeConfig(null);
      setSupabaseReady(false);
      setShowSetup(false);
      return;
    }
    saveSupabaseRuntimeConfig({ url: supaUrl, anonKey: supaAnon });
    setSupabaseReady(isSupabaseConfigured());
    setShowSetup(false);
    setError(null);
  };

  return (
    <main
      className="game-shell flex h-dvh w-dvw items-center justify-center safe-x safe-top safe-bottom"
      style={{
        background:
          theme === 'light'
            ? 'radial-gradient(circle at top left, #fff8ec 0%, #f4e6d2 55%, #e7f3ea 100%)'
            : 'radial-gradient(circle at top left, #28221d 0%, #1e1b18 100%)',
      }}
    >
      <div className="ui-card grid w-full max-w-4xl grid-cols-12 gap-4 rounded-3xl p-4 shadow-2xl backdrop-blur-md">
        {/* Left column: Profile Slot + Custom Name + 4 Character Picker */}
        <section className="col-span-7 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold tracking-tight sm:text-xl">
                🍳 {t.appTitle}
              </h1>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  supabaseReady
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
                }`}
              >
                {supabaseReady ? (
                  <>
                    <Cloud className="h-3 w-3" aria-hidden="true" /> {t.cloudActive}
                  </>
                ) : (
                  <>
                    <HardDrive className="h-3 w-3" aria-hidden="true" /> {t.localMode(DEFAULT_LOCAL_PIN)}
                  </>
                )}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Quick TR/DE toggle on Login */}
              <button
                type="button"
                onClick={() => {
                  kitchenAudio.unlockSync();
                  kitchenAudio.playTap();
                  setLang(lang === 'tr' ? 'de' : 'tr');
                }}
                aria-label={t.languageLabel}
                className="ui-subtle inline-flex h-11 items-center justify-center rounded-xl px-2.5 text-xs font-extrabold transition active:scale-95"
              >
                {lang === 'tr' ? '🇹🇷 TR' : '🇩🇪 DE'}
              </button>
              <button
                type="button"
                onClick={() => {
                  kitchenAudio.unlockSync();
                  kitchenAudio.playTap();
                  toggleTheme();
                }}
                aria-label={theme === 'light' ? t.darkTheme : t.lightTheme}
                className="ui-subtle inline-flex h-11 w-11 items-center justify-center rounded-xl transition active:scale-95"
              >
                {theme === 'light' ? (
                  <Moon className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Sun className="h-4 w-4 text-amber-300" aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowSetup((v) => !v)}
                aria-label={t.supabaseSetupTitle}
                className="ui-subtle inline-flex h-11 w-11 items-center justify-center rounded-xl transition active:scale-95"
              >
                <Settings2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-2">
            <div
              className="col-span-5 grid grid-cols-2 gap-1.5"
              role="radiogroup"
              aria-label="Slot"
            >
              {PROFILE_LIST.map((prof, idx) => {
                const active = selectedProfile === prof.id;
                return (
                  <button
                    key={prof.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => handleSelectSlot(prof.id)}
                    className={`rounded-xl border-2 px-2 py-2 text-xs font-extrabold transition active:scale-95 ${
                      active
                        ? 'border-[#e07a5f] bg-[#e07a5f]/15 text-[#c85a3f]'
                        : 'ui-surface opacity-75 hover:opacity-100'
                    }`}
                  >
                    {t.playerSlot(idx + 1)}
                  </button>
                );
              })}
            </div>

            <label className="col-span-7 relative flex items-center">
              <User
                className="pointer-events-none absolute left-3 h-4 w-4 ui-muted"
                aria-hidden="true"
              />
              <input
                type="text"
                maxLength={20}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={t.namePlaceholder}
                aria-label={t.nameAriaLabel}
                className="ui-surface w-full rounded-xl py-2 pl-9 pr-3 text-xs font-bold focus:outline-2 focus:outline-[#e07a5f]"
              />
            </label>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider ui-muted">
              {t.chooseCharacter}
            </p>
            <div
              className="grid grid-cols-4 gap-2"
              role="radiogroup"
              aria-label={t.chooseCharacter}
            >
              {CHARACTER_LIST.map((ch) => {
                const active = selectedChar === ch.id;
                const localized = t.characters[ch.id];
                return (
                  <button
                    key={ch.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      kitchenAudio.unlockSync();
                      kitchenAudio.playTap();
                      setSelectedChar(ch.id);
                    }}
                    className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-2 transition active:scale-95 ${
                      active
                        ? 'scale-[1.02] shadow-md'
                        : 'ui-surface opacity-80 hover:opacity-100'
                    }`}
                    style={
                      active
                        ? {
                            borderColor: ch.accentColor,
                            backgroundColor:
                              theme === 'light' ? ch.badgeBg : `${ch.accentColor}26`,
                          }
                        : undefined
                    }
                  >
                    <span className="text-2xl leading-none" aria-hidden="true">
                      {ch.emoji}
                    </span>
                    <span className="text-xs font-extrabold">{localized.name}</span>
                    <span className="text-[10px] ui-muted leading-tight">{localized.tagline}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Right column: Shared PIN Keypad */}
        <section className="ui-surface col-span-5 flex flex-col justify-center rounded-2xl p-3.5">
          {showSetup ? (
            <form onSubmit={handleSaveSupabase} className="space-y-2.5">
              <h2 className="text-sm font-extrabold">{t.supabaseSetupTitle}</h2>
              <p className="text-[11px] ui-muted">{t.supabaseSetupDesc}</p>
              <label className="block text-xs font-semibold">
                Project URL
                <input
                  type="url"
                  value={supaUrl}
                  onChange={(e) => setSupaUrl(e.target.value)}
                  placeholder="https://xxxx.supabase.co"
                  className="ui-subtle mt-1 w-full rounded-xl px-3 py-1.5 text-xs"
                />
              </label>
              <label className="block text-xs font-semibold">
                Anon Public Key
                <input
                  type="password"
                  value={supaAnon}
                  onChange={(e) => setSupaAnon(e.target.value)}
                  placeholder="eyJhbGciOi..."
                  className="ui-subtle mt-1 w-full rounded-xl px-3 py-1.5 text-xs"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white"
                >
                  {t.saveBtn}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSetup(false)}
                  className="ui-subtle rounded-xl px-3 py-2 text-xs font-semibold"
                >
                  {t.cancelBtn}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="pin-input"
                  className="flex items-center gap-1.5 text-xs font-bold ui-muted"
                >
                  <Lock className="h-3.5 w-3.5 text-[#e07a5f]" aria-hidden="true" />
                  {t.sharedPin}
                </label>
                <input
                  id="pin-input"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => {
                    setError(null);
                    setPin(e.target.value.replace(/\D/g, '').slice(0, 6));
                  }}
                  placeholder="1234"
                  aria-invalid={Boolean(error)}
                  className="ui-subtle w-28 rounded-xl px-3 py-1 text-center text-base font-extrabold tracking-[0.35em]"
                />
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'DEL'].map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handlePadPress(key)}
                    className={`rounded-xl py-2 text-sm font-extrabold transition active:scale-95 ${
                      key === 'DEL'
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300'
                        : 'ui-subtle hover:brightness-95'
                    }`}
                  >
                    {key === 'DEL' ? '⌫' : key}
                  </button>
                ))}
                <button
                  type="submit"
                  disabled={submitting || pin.length < 4}
                  className="rounded-xl bg-[#e07a5f] py-2 text-sm font-extrabold text-white shadow-md transition active:scale-95 disabled:opacity-45"
                >
                  {submitting ? '...' : t.enterBtn}
                </button>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-lg bg-rose-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 dark:text-rose-200"
                >
                  {error}
                </p>
              )}
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
