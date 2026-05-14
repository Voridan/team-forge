import { Injectable, Logger } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';
import { InvitationEmailPayload, MailService } from './mail.types';

const EMAIL_DATETIME_FORMAT = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export interface SmtpConfig {
  host: string;
  port: number;
  user?: string;
  password?: string;
  secure: boolean;
  from: string;
}

@Injectable()
export class NodemailerMailService extends MailService {
  private readonly logger = new Logger(NodemailerMailService.name);
  private readonly transporter: Transporter;

  constructor(private readonly smtp: SmtpConfig) {
    super();
    this.transporter = createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user && smtp.password ? { user: smtp.user, pass: smtp.password } : undefined,
    });
  }

  async sendInvitation(payload: InvitationEmailPayload): Promise<void> {
    const expiresAt = EMAIL_DATETIME_FORMAT.format(payload.expiresAt);
    const subject = `You're invited to join ${payload.teamName}`;
    const text = [
      `${payload.inviterName} invited you to join "${payload.teamName}" on TeamForge.`,
      '',
      `Accept the invitation: ${payload.acceptUrl}`,
      '',
      `This invitation expires on ${expiresAt}.`,
      '',
      'If you weren\'t expecting this invitation you can safely ignore this email.',
    ].join('\n');

    const html = this.renderHtml(payload, expiresAt);

    try {
      await this.transporter.sendMail({
        from: this.smtp.from,
        to: payload.to,
        subject,
        text,
        html,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send invitation email to ${payload.to}: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  private renderHtml(payload: InvitationEmailPayload, expiresAt: string): string {
    return `
      <!doctype html>
      <html>
        <body style="margin:0;padding:0;background:#f7f7f7;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="padding:32px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" style="background:#ffffff;border-radius:12px;border:1px solid #e5e5e5;">
                  <tr>
                    <td style="padding:32px 32px 8px;">
                      <h1 style="margin:0;font-size:20px;line-height:1.3;color:#0a0a0a;">
                        Join ${escapeHtml(payload.teamName)} on TeamForge
                      </h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 32px 24px;color:#525252;font-size:14px;line-height:1.6;">
                      <p style="margin:0 0 16px;">
                        ${escapeHtml(payload.inviterName)} invited you to collaborate with their team.
                      </p>
                      <p style="margin:0;">
                        Click the button below to accept. The invitation expires on
                        <strong>${escapeHtml(expiresAt)}</strong>.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 32px 32px;">
                      <a href="${escapeAttr(payload.acceptUrl)}"
                         style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;">
                        Accept invitation
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 32px 32px;color:#a3a3a3;font-size:12px;line-height:1.6;border-top:1px solid #f0f0f0;padding-top:16px;">
                      If you weren't expecting this you can safely ignore the email.
                      The link won't do anything without your sign-in.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `.trim();
  }
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttr(input: string): string {
  return escapeHtml(input);
}
