import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../../config/env.validation';
import { ConsoleMailService } from './console-mail.service';
import { NodemailerMailService, SmtpConfig } from './nodemailer-mail.service';
import { MailService } from './mail.types';

const DEFAULT_SMTP_PORT_TLS = 465;
const DEFAULT_MAIL_FROM = 'TeamForge <noreply@localhost>';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: MailService,
      inject: [ConfigService],
      useFactory: (
        config: ConfigService<EnvironmentVariables, true>,
      ): MailService => {
        const logger = new Logger('MailModule');
        const host = config.get('SMTP_HOST', { infer: true });

        if (!host) {
          logger.warn(
            'SMTP_HOST not set — using console mail service (dev only)',
          );
          return new ConsoleMailService();
        }

        const smtp: SmtpConfig = {
          host,
          port:
            config.get('SMTP_PORT', { infer: true }) ?? DEFAULT_SMTP_PORT_TLS,
          user: config.get('SMTP_USER', { infer: true }),
          password: config.get('SMTP_PASSWORD', { infer: true }),
          secure:
            (config.get('SMTP_PORT', { infer: true }) ??
              DEFAULT_SMTP_PORT_TLS) === 465,
          from: config.get('MAIL_FROM', { infer: true }) ?? DEFAULT_MAIL_FROM,
        };
        console.log(smtp);

        logger.log(
          `Mail transport: SMTP ${smtp.host}:${smtp.port} (secure=${smtp.secure})`,
        );
        return new NodemailerMailService(smtp);
      },
    },
  ],
  exports: [MailService],
})
export class MailModule {}
