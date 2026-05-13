import { authApi } from '@/api/auth';
import { configureAuth } from '@/api/client';
import { useAuthStore } from '@/store/auth';

export function configureApiClient(): void {
  configureAuth({
    getAccessToken: () => useAuthStore.getState().accessToken,
    refresh: async () => {
      const { refreshToken, setTokens, clearSession } = useAuthStore.getState();
      if (!refreshToken) {
        clearSession();
        throw new Error('No refresh token');
      }
      try {
        const tokens = await authApi.refresh(refreshToken);
        setTokens(tokens);
        return tokens.accessToken;
      } catch (err) {
        clearSession();
        throw err;
      }
    },
    onUnauthorized: () => {
      useAuthStore.getState().clearSession();
    },
  });
}
