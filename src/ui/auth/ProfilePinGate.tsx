import { useState, type FormEvent } from 'react';
import { Cloud, HardDrive, Lock, Settings2 } from 'lucide-react';
import {
  DEFAULT_LOCAL_PIN,
  PROFILE_LIST,
  type ProfileId,
} from '../../config/profiles';
import { kitchenAudio } from '../../domain/audio';
import { signInWithProfilePin } from '../../services/supabase/auth';
import {
  getSupabaseConfig,
  isSupabaseConfigured,
  saveSupabaseRuntimeConfig,
} from '../../services/supabase/client';
import type { BackendMode } from '../../store/useSessionStore';

interface ProfilePinGateProps {
  onSignedIn: (profileId: ProfileId, mode: BackendMode) => void;
}

export function ProfilePinGate({ onSignedIn }: ProfilePinGateProps) {
  const [selectedProfile, setSelectedProfile] = useState<ProfileId>('p1');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [showSetup, setShowSetup] = useState(false);
  const existingCfg = getSupabaseConfig();
  const [supaUrl, setSupaUrl] = useState(existingCfg?.url ?? '');
  const [supaAnon, setSupaAnon] = useState(existingCfg?.anonKey ?? '');
  const [supabaseReady, setSupabaseReady] = useState(isSupabaseConfigured);

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    kitchenAudio.unlockSync();
    setError(null);
    setSubmitting(true);

    const res = await signInWithProfilePin(selectedProfile, pin);
    setSubmitting(false);

    if (!res.ok || !res.profileId) {
      kitchenAudio.playError();
      setError(res.error ?? 'Giriş yapılamadı.');
      return;
    }

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
    <main className="game-shell flex h-dvh w-dvw items-center justify-center bg-gradient-to-br from-[#1e1b18] via-[#27211c] to-[#1a1613] safe-x safe-top safe-bottom">
      <div className="grid w-full max-w-3xl grid-cols-12 gap-4 rounded-3xl border border-white/10 bg-stone-900/80 p-5 shadow-2xl backdrop-blur-md">
        {/* Left column: Title + Fixed 2 Profiles */}
        <section className="col-span-6 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200">
                {supabaseReady ? (
                  <>
                    <Cloud className="h-3.5 w-3.5" aria-hidden="true" /> Supabase Bulut Aktif
                  </>
                ) : (
                  <>
                    <HardDrive className="h-3.5 w-3.5" aria-hidden="true" /> Yerel Ev Modu (PIN: {DEFAULT_LOCAL_PIN})
                  </>
                )}
              </span>

              <button
                type="button"
                onClick={() => setShowSetup((v) => !v)}
                aria-label="Supabase Bağlantı Ayarları"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-stone-800/70 text-stone-300 hover:bg-stone-700"
              >
                <Settings2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-amber-50">
              🍳 Bizim Mutfak
            </h1>
            <p className="mt-1 text-xs text-stone-300">
              Profilini seç ve ortak ev PIN&apos;ini gir. İster tek başına ister birlikte pişir!
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Profil Seçimi">
            {PROFILE_LIST.map((prof) => {
              const active = selectedProfile === prof.id;
              return (
                <button
                  key={prof.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    kitchenAudio.unlockSync();
                    kitchenAudio.playTap();
                    setSelectedProfile(prof.id);
                  }}
                  className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-3.5 transition active:scale-95 ${
                    active
                      ? 'border-amber-300 bg-stone-800 shadow-lg'
                      : 'border-white/10 bg-stone-900/60 opacity-75 hover:opacity-100'
                  }`}
                >
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold text-white shadow-inner"
                    style={{ backgroundColor: prof.avatarColor }}
                    aria-hidden="true"
                  >
                    👨‍🍳
                  </span>
                  <span className="text-sm font-bold text-amber-50">{prof.defaultName}</span>
                  <span className="text-[11px] text-stone-400">
                    {prof.id === 'p1' ? 'Profil 1' : 'Profil 2'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Right column: PIN Pad or Supabase Setup */}
        <section className="col-span-6 flex flex-col justify-center rounded-2xl border border-white/10 bg-stone-950/60 p-4">
          {showSetup ? (
            <form onSubmit={handleSaveSupabase} className="space-y-3">
              <h2 className="text-sm font-bold text-amber-100">Supabase Bulut Bağlantısı</h2>
              <p className="text-[11px] text-stone-400">
                2 farklı cihaz arasında gerçek zamanlı oynamak için Supabase URL ve public Anon Key girin (boş bırakırsanız yerel mod kullanılır).
              </p>
              <label className="block text-xs text-stone-300">
                Project URL
                <input
                  type="url"
                  value={supaUrl}
                  onChange={(e) => setSupaUrl(e.target.value)}
                  placeholder="https://xxxx.supabase.co"
                  className="mt-1 w-full rounded-xl border border-white/15 bg-stone-900 px-3 py-2 text-xs text-white"
                />
              </label>
              <label className="block text-xs text-stone-300">
                Anon Public Key
                <input
                  type="password"
                  value={supaAnon}
                  onChange={(e) => setSupaAnon(e.target.value)}
                  placeholder="eyJhbGciOi..."
                  className="mt-1 w-full rounded-xl border border-white/15 bg-stone-900 px-3 py-2 text-xs text-white"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-stone-950"
                >
                  Kaydet
                </button>
                <button
                  type="button"
                  onClick={() => setShowSetup(false)}
                  className="rounded-xl border border-white/15 px-3 py-2 text-xs text-stone-300"
                >
                  Vazgeç
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex items-center justify-between">
                <label htmlFor="pin-input" className="flex items-center gap-1.5 text-xs font-semibold text-stone-300">
                  <Lock className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                  Ortak Ev PIN&apos;i
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
                  placeholder="••••"
                  aria-invalid={Boolean(error)}
                  className="w-28 rounded-xl border border-white/15 bg-stone-900 px-3 py-1.5 text-center text-base font-bold tracking-[0.35em] text-amber-100"
                />
              </div>

              {/* Compact 4x3 landscape numeric touch pad */}
              <div className="grid grid-cols-4 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'DEL'].map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handlePadPress(key)}
                    className={`rounded-xl border border-white/10 py-2 text-sm font-bold transition active:scale-95 ${
                      key === 'DEL'
                        ? 'bg-stone-800 text-rose-300'
                        : 'bg-stone-800/80 text-stone-100 hover:bg-stone-700'
                    }`}
                  >
                    {key === 'DEL' ? '⌫' : key}
                  </button>
                ))}
                <button
                  type="submit"
                  disabled={submitting || pin.length < 4}
                  className="rounded-xl bg-amber-500 py-2 text-sm font-extrabold text-stone-950 shadow-md transition active:scale-95 disabled:opacity-45"
                >
                  {submitting ? '...' : 'GİR'}
                </button>
              </div>

              {error && (
                <p role="alert" className="rounded-lg bg-rose-950/70 px-2.5 py-1.5 text-xs text-rose-200">
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
