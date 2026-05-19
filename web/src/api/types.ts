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
  acceptedInvitationTeamId?: string;
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

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Task {
  id: string;
  teamId: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  assigneeUserId: string | null;
  reporterUserId: string | null;
  dueDate: string | null;
  labels: string[];
  parentTaskId: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  teamId: string;
  authorUserId: string | null;
  content: string;
  createdAt: string;
  editedAt: string | null;
}

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export interface TeamInvitation {
  id: string;
  teamId: string;
  email: string;
  role: TeamRole;
  invitedByUserId: string | null;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
}

export interface InvitationPreview {
  email: string;
  teamId: string;
  teamName: string;
  role: TeamRole;
  inviterName: string | null;
  expiresAt: string;
}

export interface CreateInvitationsResult {
  created: { id: string; email: string; status: InvitationStatus }[];
  skipped: { email: string; reason: string }[];
}

export interface AcceptInvitationResult {
  teamId: string;
}

export type ChannelType = 'PUBLIC' | 'PRIVATE';
export type AttachmentStatus = 'PENDING' | 'UPLOADED' | 'LINKED';

export interface Channel {
  id: string;
  teamId: string;
  name: string;
  description: string | null;
  type: ChannelType;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  teamId: string;
  uploaderUserId: string | null;
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: AttachmentStatus;
  linkedMessageId: string | null;
  createdAt: string;
  uploadedAt: string | null;
}

export interface Message {
  id: string;
  channelId: string;
  teamId: string;
  authorUserId: string | null;
  content: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  attachments: Attachment[];
}

export interface MessagePage {
  items: Message[];
  nextCursor: string | null;
}

export interface PresignedUpload {
  attachmentId: string;
  uploadUrl: string;
  expiresAt: string;
}

export interface DownloadInfo {
  downloadUrl: string;
  expiresAt: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}
