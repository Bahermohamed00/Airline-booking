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

/**
 * Verification and password-reset links carry raw account-takeover tokens in
 * their `token=` query param, and MFA emails carry a 6-digit code on its own
 * line after the "security code" label. Logs must never contain either
 * (ADR-0004), in any environment — redact the values, keep the message shape
 * for debugging. The token param name match is case-insensitive so pasted or
 * reformatted links stay safe.
 */
export function redactTokensForLog(text: string): string {
  return text
    .replace(/([?&]token=)[^\s&]+/gi, '$1<redacted>')
    .replace(/(security code[^\n]*\n+)\d{6}/i, '$1<redacted>');
}

/** Dev/test adapter: mails go to the API log instead of an SMTP server. */
export class ConsoleMailAdapter implements MailAdapter {
  private readonly logger = new Logger('Mail');

  async send(message: MailMessage): Promise<void> {
    this.logger.log(`To: ${message.to}\nSubject: ${message.subject}\n${redactTokensForLog(message.text)}`);
  }
}

/** Validated SMTP settings. Secrets are never echoed into errors or logs. */
export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

function requiredEnv(config: ConfigService, key: string): string {
  const value = config.get<string>(key);
  // Trimming is validation-only: the original value is returned unchanged.
  if (value === undefined || value.trim() === '') {
    throw new Error(`Mail configuration error: ${key} is required when NOTIFICATION_PROVIDER=smtp`);
  }
  return value;
}

/**
 * Reads and validates the documented SMTP contract (.env.example): every
 * variable is required in smtp mode, and the port must be a decimal integer
 * literal — Number() alone would accept hex ('0x10') or padded values, so the
 * raw string must be digits only before the range check.
 */
export function readSmtpConfig(config: ConfigService): SmtpConfig {
  const host = requiredEnv(config, 'SMTP_HOST');
  const portRaw = requiredEnv(config, 'SMTP_PORT');
  const port = /^\d+$/.test(portRaw) ? Number(portRaw) : NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Mail configuration error: SMTP_PORT must be a decimal integer between 1 and 65535');
  }
  const user = requiredEnv(config, 'SMTP_USER');
  const pass = requiredEnv(config, 'SMTP_PASS');
  const from = requiredEnv(config, 'MAIL_FROM');
  return { host, port, user, pass, from };
}

export class SmtpMailAdapter implements MailAdapter {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(smtp: SmtpConfig) {
    this.from = smtp.from;
    this.transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
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
