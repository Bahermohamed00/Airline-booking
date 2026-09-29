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
  ) {}

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
}
