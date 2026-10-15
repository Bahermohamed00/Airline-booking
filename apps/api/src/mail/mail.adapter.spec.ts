import { describe, it, expect, vi, afterEach } from 'vitest';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsoleMailAdapter, readSmtpConfig, redactTokensForLog, type SmtpConfig } from './mail.adapter';
import { MailService } from './mail.service';

const VALID_SMTP_ENV: Record<string, string> = {
  SMTP_HOST: 'smtp.example.test',
  SMTP_PORT: '587',
  SMTP_USER: 'mail-user',
  SMTP_PASS: 'mail-pass',
  MAIL_FROM: 'NovaAir <no-reply@example.test>',
};

describe('redactTokensForLog', () => {
  it('redacts token query param values and keeps the URL shape', () => {
    const text = 'Confirm: http://localhost:4200/verify-email?token=s3cret-token-value\nExpires in 24 hours.';
    const redacted = redactTokensForLog(text);
    expect(redacted).not.toContain('s3cret-token-value');
    expect(redacted).toContain('/verify-email?token=<redacted>');
    expect(redacted).toContain('Expires in 24 hours.');
  });

  it('redacts multiple and non-final token params', () => {
    const text = 'a?token=first&x=1 b?token=second';
    const redacted = redactTokensForLog(text);
    expect(redacted).not.toContain('first');
    expect(redacted).not.toContain('second');
    expect(redacted).toContain('a?token=<redacted>&x=1');
    expect(redacted).toContain('b?token=<redacted>');
  });

  it('redacts the param name case-insensitively', () => {
    const text = 'a?TOKEN=upper b?Token=mixed&x=1 c?token=lower';
    const redacted = redactTokensForLog(text);
    expect(redacted).not.toContain('upper');
    expect(redacted).not.toContain('mixed');
    expect(redacted).not.toContain('lower');
    expect(redacted).toContain('a?TOKEN=<redacted>');
    expect(redacted).toContain('b?Token=<redacted>&x=1');
    expect(redacted).toContain('c?token=<redacted>');
  });

  it('redacts a 6-digit MFA security code in an email body', () => {
    const text =
      'Hello Test,\n\nYour NovaAir security code to finish signing in is:\n\n482910\n\nThis code expires in 10 minutes.';
    const redacted = redactTokensForLog(text);
    expect(redacted).not.toContain('482910');
    expect(redacted).toContain('security code');
    expect(redacted).toContain('<redacted>');
  });
});

describe('ConsoleMailAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function captureMailLog() {
    return vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  }

  it('never logs raw verification or password-reset tokens, in any environment', async () => {
    const spy = captureMailLog();
    const adapter = new ConsoleMailAdapter();
    const mail = new MailService(adapter, new ConfigService({}));

    const verificationToken = 'verify-raw-token-9f8e7d6c5b';
    const resetToken = 'reset-raw-token-1a2b3c4d5e';
    await mail.sendVerificationEmail({ email: 'user@example.test', firstName: 'Lena' }, verificationToken);
    await mail.sendPasswordResetEmail({ email: 'user@example.test', firstName: 'Lena' }, resetToken);

    const logged = spy.mock.calls.flat().join('\n');
    expect(logged).not.toContain(verificationToken);
    expect(logged).not.toContain(resetToken);
    // Debugging value is preserved: recipient, subject, and redacted link path.
    expect(logged).toContain('user@example.test');
    expect(logged).toContain('Verify your NovaAir email address');
    expect(logged).toContain('/verify-email?token=<redacted>');
    expect(logged).toContain('/reset-password?token=<redacted>');
  });
});

describe('readSmtpConfig', () => {
  it('returns the validated config for a complete environment', () => {
    const smtp = readSmtpConfig(new ConfigService(VALID_SMTP_ENV));
    expect(smtp).toEqual({
      host: 'smtp.example.test',
      port: 587,
      user: 'mail-user',
      pass: 'mail-pass',
      from: 'NovaAir <no-reply@example.test>',
    } satisfies SmtpConfig);
  });

  it.each(Object.keys(VALID_SMTP_ENV))('throws naming %s when it is missing', (key) => {
    const env = { ...VALID_SMTP_ENV };
    delete env[key];
    expect(() => readSmtpConfig(new ConfigService(env))).toThrow(new RegExp(key));
  });

  it.each(Object.keys(VALID_SMTP_ENV))('rejects a whitespace-only %s', (key) => {
    expect(() => readSmtpConfig(new ConfigService({ ...VALID_SMTP_ENV, [key]: '   ' }))).toThrow(new RegExp(key));
  });

  it.each(['abc', '0', '65536', '1.5', '587x', '0x10', ' 587 '])('rejects SMTP_PORT %p', (port) => {
    expect(() => readSmtpConfig(new ConfigService({ ...VALID_SMTP_ENV, SMTP_PORT: port }))).toThrow(
      /SMTP_PORT must be a decimal integer between 1 and 65535/,
    );
  });

  it('returns validated values unchanged — no trimming or normalization', () => {
    const smtp = readSmtpConfig(new ConfigService(VALID_SMTP_ENV));
    expect(smtp.host).toBe(VALID_SMTP_ENV['SMTP_HOST']);
    expect(smtp.user).toBe(VALID_SMTP_ENV['SMTP_USER']);
    expect(smtp.pass).toBe(VALID_SMTP_ENV['SMTP_PASS']);
    expect(smtp.from).toBe(VALID_SMTP_ENV['MAIL_FROM']);
  });

  it('never echoes secret values into error messages', () => {
    const env = { ...VALID_SMTP_ENV };
    delete env['SMTP_USER'];
    let message = '';
    try {
      readSmtpConfig(new ConfigService(env));
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('SMTP_USER');
    expect(message).not.toContain('mail-pass');
    expect(message).not.toContain('smtp.example.test');
  });
});
