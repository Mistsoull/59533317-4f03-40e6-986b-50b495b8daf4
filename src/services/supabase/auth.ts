import {
  DEFAULT_LOCAL_PIN,
  PROFILES,
  formatPinPassword,
  type ProfileId,
} from '../../config/profiles';
import { getSupabaseClient, isSupabaseConfigured } from './client';
import type { BackendMode } from '../../store/useSessionStore';

const SUPABASE_PROFILE_STORAGE_KEY = 'cozy_kitchen_profile_id_v1';
const LOCAL_PROFILE_SESSION_KEY = 'cozy_kitchen_local_profile_v1';

export interface AuthResult {
  ok: boolean;
  profileId?: ProfileId;
  backendMode: BackendMode;
  error?: string;
}

export async function restoreAuthSession(): Promise<AuthResult> {
  const supabase = getSupabaseClient();

  if (supabase) {
    const { data, error } = await supabase.auth.getSession();
    if (!error && data.session?.user?.email) {
      const email = data.session.user.email.toLowerCase();
      const matched: ProfileId | null =
        email === PROFILES.p1.email
          ? 'p1'
          : email === PROFILES.p2.email
            ? 'p2'
            : ((localStorage.getItem(SUPABASE_PROFILE_STORAGE_KEY) as ProfileId | null) ??
              null);
      if (matched) {
        return { ok: true, profileId: matched, backendMode: 'supabase' };
      }
    }
    return { ok: false, backendMode: 'supabase' };
  }

  // Local mode uses sessionStorage so 2 tabs can test p1 & p2 simultaneously
  try {
    const localProfile = sessionStorage.getItem(LOCAL_PROFILE_SESSION_KEY) as ProfileId | null;
    if (localProfile === 'p1' || localProfile === 'p2') {
      return { ok: true, profileId: localProfile, backendMode: 'local' };
    }
  } catch {
    // Ignore storage errors
  }

  return { ok: false, backendMode: 'local' };
}

export async function signInWithProfilePin(
  profileId: ProfileId,
  pin: string,
): Promise<AuthResult> {
  const cleanPin = pin.trim();
  if (cleanPin.length < 4) {
    return {
      ok: false,
      backendMode: isSupabaseConfigured() ? 'supabase' : 'local',
      error: 'PIN en az 4 haneli olmalıdır.',
    };
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    const profile = PROFILES[profileId];
    const { error } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: formatPinPassword(cleanPin),
    });

    if (error) {
      return {
        ok: false,
        backendMode: 'supabase',
        error: 'PIN hatalı veya Supabase kullanıcıları (p1/p2@home.local) henüz oluşturulmadı.',
      };
    }

    try {
      localStorage.setItem(SUPABASE_PROFILE_STORAGE_KEY, profileId);
    } catch {
      // Ignore storage errors
    }

    return { ok: true, profileId, backendMode: 'supabase' };
  }

  // Local multi-tab demo mode
  if (cleanPin !== DEFAULT_LOCAL_PIN) {
    return {
      ok: false,
      backendMode: 'local',
      error: `Yerel demo modunda ortak PIN: ${DEFAULT_LOCAL_PIN}`,
    };
  }

  try {
    sessionStorage.setItem(LOCAL_PROFILE_SESSION_KEY, profileId);
  } catch {
    // Ignore
  }

  return { ok: true, profileId, backendMode: 'local' };
}

export async function signOutProfile(): Promise<void> {
  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  try {
    localStorage.removeItem(SUPABASE_PROFILE_STORAGE_KEY);
    sessionStorage.removeItem(LOCAL_PROFILE_SESSION_KEY);
  } catch {
    // Ignore
  }
}
