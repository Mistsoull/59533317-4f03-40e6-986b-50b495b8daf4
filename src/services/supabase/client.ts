import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const RUNTIME_CONFIG_KEY = 'cozy_kitchen_supabase_cfg_v1';

export interface SupabaseRuntimeConfig {
  url: string;
  anonKey: string;
}

let cachedClient: SupabaseClient | null = null;
let cachedConfigHash = '';

export function getSupabaseConfig(): SupabaseRuntimeConfig | null {
  const envUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (envUrl && envKey && !envUrl.includes('your-project-ref')) {
    return { url: envUrl, anonKey: envKey };
  }

  try {
    const raw = localStorage.getItem(RUNTIME_CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SupabaseRuntimeConfig>;
    if (parsed.url?.startsWith('https://') && parsed.anonKey && parsed.anonKey.length > 20) {
      return { url: parsed.url.trim(), anonKey: parsed.anonKey.trim() };
    }
  } catch {
    return null;
  }

  return null;
}

export function saveSupabaseRuntimeConfig(cfg: SupabaseRuntimeConfig | null): void {
  cachedClient = null;
  cachedConfigHash = '';
  try {
    if (!cfg) {
      localStorage.removeItem(RUNTIME_CONFIG_KEY);
    } else {
      localStorage.setItem(
        RUNTIME_CONFIG_KEY,
        JSON.stringify({ url: cfg.url.trim(), anonKey: cfg.anonKey.trim() }),
      );
    }
  } catch {
    // Ignore storage errors
  }
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}

export function getSupabaseClient(): SupabaseClient | null {
  const cfg = getSupabaseConfig();
  if (!cfg) return null;

  const hash = `${cfg.url}|${cfg.anonKey}`;
  if (cachedClient && cachedConfigHash === hash) {
    return cachedClient;
  }

  cachedConfigHash = hash;
  cachedClient = createClient(cfg.url, cfg.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 20,
      },
    },
  });

  return cachedClient;
}

/**
 * Ephemeral anonymous client strictly for read-only lobby Presence observation.
 * Keeping this socket separate from the main authenticated SupabaseClient avoids
 * auth-upgrade / topic-rejoin interference on `kitchen:home` during sign-in.
 */
export function createLobbyObserverClient(): SupabaseClient | null {
  const cfg = getSupabaseConfig();
  if (!cfg) return null;

  return createClient(cfg.url, cfg.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'cozy_kitchen_lobby_observer_ephemeral',
    },
  });
}
