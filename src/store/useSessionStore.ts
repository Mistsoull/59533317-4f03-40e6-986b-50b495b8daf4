import { create } from 'zustand';
import type { ProfileId } from '../config/profiles';
import type { PresencePayload } from '../services/supabase/types';

export type BackendMode = 'supabase' | 'local';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

interface SessionState {
  profileId: ProfileId | null;
  backendMode: BackendMode;
  connectionStatus: ConnectionStatus;
  onlineProfiles: Partial<Record<ProfileId, PresencePayload>>;
  setSession: (profileId: ProfileId | null, backendMode: BackendMode) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setOnlineProfiles: (profiles: Partial<Record<ProfileId, PresencePayload>>) => void;
  resetSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  profileId: null,
  backendMode: 'local',
  connectionStatus: 'disconnected',
  onlineProfiles: {},

  setSession: (profileId, backendMode) => set({ profileId, backendMode }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setOnlineProfiles: (onlineProfiles) => set({ onlineProfiles }),
  resetSession: () =>
    set({
      profileId: null,
      connectionStatus: 'disconnected',
      onlineProfiles: {},
    }),
}));
