import { create } from 'zustand';

export interface IncomingCall {
  teamId: string;
  callId: string;
  callerId: string;
}

interface IncomingCallState {
  current: IncomingCall | null;
  show: (call: IncomingCall) => void;
  dismiss: () => void;
}

/**
 * Holds the most recent unhandled `call:incoming` event so the UI can render
 * an accept/decline toast. Cleared when the user accepts (transitions to the
 * active-call store) or declines, or when the call ends.
 */
export const useIncomingCallStore = create<IncomingCallState>((set) => ({
  current: null,
  show: (call) => set({ current: call }),
  dismiss: () => set({ current: null }),
}));
