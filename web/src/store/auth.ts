import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PublicUser, TokenPair } from "@/api/types";

interface AuthState {
  user: PublicUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (user: PublicUser, tokens: TokenPair) => void;
  setTokens: (tokens: TokenPair) => void;
  setUser: (user: PublicUser) => void;
  clearSession: () => void;
}

// TODO: not store tokens in storage, only in memory. and refresh when close to expiry
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setSession: (user, tokens) =>
        set({
          user,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        }),
      setTokens: (tokens) =>
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        }),
      setUser: (user) => set({ user }),
      clearSession: () =>
        set({ user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: "teamforge.auth",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
);
