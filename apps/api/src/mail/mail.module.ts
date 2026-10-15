import { Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MAIL_ADAPTER, ConsoleMailAdapter, SmtpMailAdapter, readSmtpConfig, type MailAdapter } from './mail.adapter.js';
import { MailService } from './mail.service.js';

@Module({
  providers: [
    {
      provide: MAIL_ADAPTER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): MailAdapter => {
        const logger = new Logger('Mail');
        const provider = config.get<string>('NOTIFICATION_PROVIDER');
        const isProduction = config.get<string>('NODE_ENV') === 'production';

        // Unset or 'mock' keeps the documented development/test behavior —
        // but never in production: email would silently go nowhere and the
        // console adapter would write message content to the API log.
        if (provider === undefined || provider === 'mock') {
          if (isProduction) {
            throw new Error(
              'Mail configuration error: NOTIFICATION_PROVIDER=smtp is required when NODE_ENV=production (console mail adapter is not allowed)',
            );
          }
          logger.log('Mail adapter: console — emails are logged (tokens redacted), not sent (set NOTIFICATION_PROVIDER=smtp + SMTP_* for real delivery)');
          return new ConsoleMailAdapter();
        }

        // Unsupported values are rejected in every environment — no silent
        // fallback to the console adapter.
        if (provider !== 'smtp') {
          throw new Error("Mail configuration error: unsupported NOTIFICATION_PROVIDER value; expected 'mock' or 'smtp'");
        }

        // Never log credentials — host/port only.
        const smtp = readSmtpConfig(config);
        logger.log(`Mail adapter: smtp (host ${smtp.host}, port ${smtp.port})`);
        return new SmtpMailAdapter(smtp);
      },
    },
    MailService,
  ],
  exports: [MailService, MAIL_ADAPTER],
})
export class MailModule {}
