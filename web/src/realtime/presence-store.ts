import { create } from 'zustand';

export type PresenceStatus = 'ONLINE' | 'OFFLINE';

interface PresenceState {
  /** userId → status. Missing entries are treated as OFFLINE. */
  byUser: Record<string, PresenceStatus>;
  setStatus: (userId: string, status: PresenceStatus) => void;
  isOnline: (userId: string) => boolean;
  clear: () => void;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  byUser: {},

  setStatus: (userId, status) => {
    set((state) => {
      // Skip the update if nothing actually changed — avoids re-renders.
      if (state.byUser[userId] === status) return state;
      return { byUser: { ...state.byUser, [userId]: status } };
    });
  },

  isOnline: (userId) => get().byUser[userId] === 'ONLINE',

  clear: () => set({ byUser: {} }),
}));
