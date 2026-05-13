export type AuthProvider = 'LOCAL' | 'GOOGLE';
export type TeamRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
export type UserStatus = 'ONLINE' | 'AWAY' | 'DND' | 'OFFLINE';

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  status: UserStatus;
  createdAt: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: PublicUser;
  tokens: TokenPair;
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeamSummary {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  role: TeamRole;
  createdAt: string;
}

export interface TeamMemberPublic {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: TeamRole;
  joinedAt: string;
}

export interface FieldError {
  field: string;
  code: string;
  message: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: FieldError[];
}

export interface ApiEnvelope<T> {
  data: T;
}
