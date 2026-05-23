import { create } from 'zustand';

const TYPING_TTL_MS = 6_000; // a bit longer than the server's 5s auto-stop

interface TypingState {
  /** channelId → Set<userId> of users currently typing in that channel */
  byChannel: Record<string, string[]>;
  markTyping: (channelId: string, userId: string) => void;
  markStopped: (channelId: string, userId: string) => void;
  getForChannel: (channelId: string) => string[];
}

// Per-(channel,user) auto-clear timers. Kept outside the Zustand state so they
// don't cause re-renders and aren't part of equality checks.
const timers = new Map<string, NodeJS.Timeout>();

function timerKey(channelId: string, userId: string): string {
  return `${channelId}::${userId}`;
}

export const useTypingStore = create<TypingState>((set, get) => ({
  byChannel: {},

  markTyping: (channelId, userId) => {
    const key = timerKey(channelId, userId);
    const existing = timers.get(key);
    if (existing) clearTimeout(existing);

    timers.set(
      key,
      setTimeout(() => {
        get().markStopped(channelId, userId);
        timers.delete(key);
      }, TYPING_TTL_MS),
    );

    set((state) => {
      const current = state.byChannel[channelId] ?? [];
      if (current.includes(userId)) return state; // already known
      return { byChannel: { ...state.byChannel, [channelId]: [...current, userId] } };
    });
  },

  markStopped: (channelId, userId) => {
    const key = timerKey(channelId, userId);
    const existing = timers.get(key);
    if (existing) {
      clearTimeout(existing);
      timers.delete(key);
    }
    set((state) => {
      const current = state.byChannel[channelId];
      if (!current || !current.includes(userId)) return state;
      const next = current.filter((id) => id !== userId);
      const byChannel = { ...state.byChannel };
      if (next.length === 0) delete byChannel[channelId];
      else byChannel[channelId] = next;
      return { byChannel };
    });
  },

  getForChannel: (channelId) => get().byChannel[channelId] ?? [],
}));
