import { useEffect, useRef, type ReactNode } from 'react';
import { usersApi } from '@/api/users';
import { useAuthStore } from '@/store/auth';

/**
 * On app load, if we have a persisted access token, refresh the user profile
 * once to validate the session and update cached fields.
 */
export function SessionBootstrap({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setUser = useAuthStore((s) => s.setUser);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current || !accessToken) return;
    ranRef.current = true;
    usersApi.getMe().then(setUser).catch(() => {
      /* session will be cleared by the API client's onUnauthorized */
    });
  }, [accessToken, setUser]);

  return <>{children}</>;
}
