import { GoogleOAuthProvider } from '@react-oauth/google';
import type { ReactNode } from 'react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export function ConditionalGoogleOAuth({ children }: { children: ReactNode }) {
  if (!CLIENT_ID) return <>{children}</>;
  return <GoogleOAuthProvider clientId={CLIENT_ID}>{children}</GoogleOAuthProvider>;
}

export const isGoogleOAuthEnabled = Boolean(CLIENT_ID);
