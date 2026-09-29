import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

export const MAIL_ADAPTER = 'MAIL_ADAPTER';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface MailAdapter {
  send(message: MailMessage): Promise<void>;
}

/** Dev/test adapter: mails go to the API log instead of an SMTP server. */
export class ConsoleMailAdapter implements MailAdapter {
  private readonly logger = new Logger('Mail');

  async send(message: MailMessage): Promise<void> {
    this.logger.log(`To: ${message.to}\nSubject: ${message.subject}\n${message.text}`);
  }
}

export class SmtpMailAdapter implements MailAdapter {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.from = config.get<string>('MAIL_FROM', 'no-reply@airline.local');
    this.transporter = nodemailer.createTransport({
      host: config.getOrThrow<string>('SMTP_HOST'),
      port: Number(config.get<string>('SMTP_PORT', '587')),
      auth: {
        user: config.get<string>('SMTP_USER'),
        pass: config.get<string>('SMTP_PASS'),
      },
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  }
}
