import { create } from 'zustand';

export interface ActiveCallSession {
  teamId: string;
  callId: string;
  livekitUrl: string;
  token: string;
}

interface ActiveCallState {
  session: ActiveCallSession | null;
  enter: (session: ActiveCallSession) => void;
  exit: () => void;
}

/**
 * Holds the LiveKit connection params for the call the user is currently in.
 * Set when the user starts or accepts a call (after the api hands back a token),
 * cleared when they hang up or the call ends.
 *
 * Token is short-lived (1h, see api/src/modules/calls/livekit.service.ts) and
 * never persisted — if the user reloads, they need to rejoin via the active-call
 * endpoint to get a fresh one.
 */
export const useActiveCallStore = create<ActiveCallState>((set) => ({
  session: null,
  enter: (session) => set({ session }),
  exit: () => set({ session: null }),
}));
