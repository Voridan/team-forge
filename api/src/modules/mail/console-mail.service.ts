import { Injectable, Logger } from '@nestjs/common';
import { InvitationEmailPayload, MailService } from './mail.types';

const EMAIL_DATETIME_FORMAT = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/**
 * Dev/local implementation of MailService. Logs the email content to the
 * NestJS logger so developers can grab the invite URL from the console.
 * Replace with an SMTP / Resend / Postmark implementation in production.
 */
@Injectable()
export class ConsoleMailService extends MailService {
  private readonly logger = new Logger('Mail');

  async sendInvitation(payload: InvitationEmailPayload): Promise<void> {
    const expiresAt = EMAIL_DATETIME_FORMAT.format(payload.expiresAt);
    this.logger.log(
      [
        '',
        '┌────────────────────────────────────────────────────────────',
        `│ To: ${payload.to}`,
        `│ Subject: You're invited to join ${payload.teamName}`,
        '├────────────────────────────────────────────────────────────',
        `│ ${payload.inviterName} invited you to join "${payload.teamName}".`,
        '│',
        `│ Accept: ${payload.acceptUrl}`,
        `│ Expires: ${expiresAt}`,
        '└────────────────────────────────────────────────────────────',
        '',
      ].join('\n'),
    );
  }
}
