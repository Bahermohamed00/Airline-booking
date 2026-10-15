import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MAIL_ADAPTER, type MailAdapter } from './mail.adapter.js';

export interface MailRecipient {
  email: string;
  firstName: string;
}

@Injectable()
export class MailService {
  constructor(
    @Inject(MAIL_ADAPTER) private readonly adapter: MailAdapter,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {
    // Production must never email localhost verification/reset links. Fail at
    // startup (not at send time) when WEB_ORIGIN is missing or loopback.
    // WHATWG URL parsing normalizes IPv4 shorthand (127.1, hex, octal →
    // 127.0.0.1) and bracketed IPv6, so exact hostname matches cover those
    // forms; hostnames merely starting with "localhost" stay valid. Origins
    // that fail to parse (e.g. scheme-less values) are rejected too — they
    // cannot be proven non-loopback and would build broken links. Loopback
    // spellings the URL parser does not understand are a known limitation.
    if (this.config.get<string>('NODE_ENV') === 'production') {
      const origin = this.config.get<string>('WEB_ORIGIN');
      let hostname = '';
      if (origin) {
        try {
          hostname = new URL(origin).hostname.toLowerCase();
        } catch {
          hostname = '';
        }
      }
      if (hostname === '' || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1') {
        throw new Error('Mail configuration error: WEB_ORIGIN must be set to the public web origin when NODE_ENV=production');
      }
    }
  }

  async sendVerificationEmail(user: MailRecipient, rawToken: string): Promise<void> {
    const url = `${this.webOrigin()}/verify-email?token=${rawToken}`;
    await this.adapter.send({
      to: user.email,
      subject: 'Verify your NovaAir email address',
      text: `Hello ${user.firstName},\n\nConfirm your email address to activate your account:\n${url}\n\nThis link expires in 24 hours.`,
    });
  }

  async sendPasswordResetEmail(user: MailRecipient, rawToken: string): Promise<void> {
    const url = `${this.webOrigin()}/reset-password?token=${rawToken}`;
    await this.adapter.send({
      to: user.email,
      subject: 'Reset your NovaAir password',
      text: `Hello ${user.firstName},\n\nReset your password using this link:\n${url}\n\nThis link expires in 1 hour. If you did not request it, ignore this email.`,
    });
  }

  private webOrigin(): string {
    return this.config.get<string>('WEB_ORIGIN', 'http://localhost:4200');
  }

  /** Support agent reply to a customer's ticket. The adapter decides delivery. */
  async sendSupportReplyEmail(customer: MailRecipient, ticketNumber: string, body: string): Promise<void> {
    await this.adapter.send({
      to: customer.email,
      subject: `Re: your support request ${ticketNumber}`,
      text: `Hello ${customer.firstName},\n\nOur support team replied to your request ${ticketNumber}:\n\n${body}\n\n— NovaAir Support`,
    });
  }

  /**
   * 6-digit MFA code for a login challenge or an enable/disable confirmation.
   * The code sits on its own line so the console adapter can redact it.
   */
  async sendMfaCodeEmail(user: MailRecipient, code: string, purpose: 'LOGIN' | 'ENABLE' | 'DISABLE'): Promise<void> {
    const action =
      purpose === 'LOGIN'
        ? 'finish signing in'
        : purpose === 'ENABLE'
          ? 'enable two-factor authentication'
          : 'disable two-factor authentication';
    await this.adapter.send({
      to: user.email,
      subject: 'Your NovaAir security code',
      text: `Hello ${user.firstName},\n\nYour NovaAir security code to ${action} is:\n\n${code}\n\nThis code expires in 10 minutes. If you requested several codes, only the newest one works. If you did not request it, ignore this email and consider changing your password.`,
    });
  }
}
