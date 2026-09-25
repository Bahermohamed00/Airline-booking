import { Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MAIL_ADAPTER, ConsoleMailAdapter, SmtpMailAdapter, type MailAdapter } from './mail.adapter.js';
import { MailService } from './mail.service.js';

@Module({
  providers: [
    {
      provide: MAIL_ADAPTER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): MailAdapter => {
        const logger = new Logger('Mail');
        if (config.get<string>('NOTIFICATION_PROVIDER', 'mock') === 'smtp') {
          // Never log credentials — host/port only.
          logger.log(`Mail adapter: smtp (host ${config.getOrThrow<string>('SMTP_HOST')}, port ${config.get<string>('SMTP_PORT', '587')})`);
          return new SmtpMailAdapter(config);
        }
        logger.log('Mail adapter: console — emails are logged, not sent (set NOTIFICATION_PROVIDER=smtp + SMTP_* for real delivery)');
        return new ConsoleMailAdapter();
      },
    },
    MailService,
  ],
  exports: [MailService, MAIL_ADAPTER],
})
export class MailModule {}
