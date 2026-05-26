import { AuthProvider } from '../../../../generated/prisma/client';

export interface NormalizedOAuthProfile {
  externalId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
}

export interface OAuthProvider {
  readonly name: string;
  readonly authProvider: AuthProvider;
  verifyIdToken(idToken: string): Promise<NormalizedOAuthProfile>;
}
