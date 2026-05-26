export interface InvitationEmailPayload {
  to: string;
  inviterName: string;
  teamName: string;
  acceptUrl: string;
  expiresAt: Date;
}

export abstract class MailService {
  abstract sendInvitation(payload: InvitationEmailPayload): Promise<void>;
}
