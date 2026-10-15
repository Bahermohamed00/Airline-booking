import { describe, it, expect, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import type { MailAdapter, MailMessage } from './mail.adapter';

const createFakeAdapter = () => {
  const sent: MailMessage[] = [];
  const adapter: MailAdapter = {
    send: vi.fn((message: MailMessage) => {
      sent.push(message);
      return Promise.resolve();
    }),
  };
  return { adapter, sent };
};

const user = { email: 'user@example.test', firstName: 'Lena' };

describe('MailService', () => {
  describe('link building', () => {
    it('builds verification and reset links from WEB_ORIGIN', async () => {
      const { adapter, sent } = createFakeAdapter();
      const mail = new MailService(adapter, new ConfigService({ WEB_ORIGIN: 'https://www.novaair.example' }));

      await mail.sendVerificationEmail(user, 'raw-verify-token');
      await mail.sendPasswordResetEmail(user, 'raw-reset-token');

      expect(sent[0]!.text).toContain('https://www.novaair.example/verify-email?token=raw-verify-token');
      expect(sent[1]!.text).toContain('https://www.novaair.example/reset-password?token=raw-reset-token');
    });

    it('defaults WEB_ORIGIN to the local dev origin outside production', async () => {
      const { adapter, sent } = createFakeAdapter();
      const mail = new MailService(adapter, new ConfigService({}));

      await mail.sendVerificationEmail(user, 'raw-token');
      expect(sent[0]!.text).toContain('http://localhost:4200/verify-email?token=raw-token');
    });
  });

  describe('sendMfaCodeEmail', () => {
    it('builds a 10-minute security-code email for each purpose', async () => {
      const { adapter, sent } = createFakeAdapter();
      const mail = new MailService(adapter, new ConfigService({}));

      await mail.sendMfaCodeEmail(user, '482910', 'LOGIN');
      await mail.sendMfaCodeEmail(user, '482910', 'ENABLE');
      await mail.sendMfaCodeEmail(user, '482910', 'DISABLE');

      expect(sent).toHaveLength(3);
      expect(sent[0]!.to).toBe(user.email);
      expect(sent[0]!.subject).toBe('Your NovaAir security code');
      expect(sent[0]!.text).toContain('482910');
      expect(sent[0]!.text).toContain('10 minutes');
      expect(sent[0]!.text).toContain('only the newest one works');
      expect(sent[0]!.text).toContain('finish signing in');
      expect(sent[1]!.text).toContain('enable two-factor authentication');
      expect(sent[2]!.text).toContain('disable two-factor authentication');
    });
  });

  describe('WEB_ORIGIN production validation', () => {    it.each([
      [undefined],
      ['http://localhost:4200'],
      ['https://localhost'],
      ['http://127.0.0.1:4200'],
      ['http://127.1:4200'],
      ['http://0x7f.1'],
      ['http://[::1]:4200'],
      ['www.novaair.example'],
    ])('throws at construction in production when WEB_ORIGIN is %p', (origin) => {
      const { adapter } = createFakeAdapter();
      const config = new ConfigService(origin ? { NODE_ENV: 'production', WEB_ORIGIN: origin } : { NODE_ENV: 'production' });
      expect(() => new MailService(adapter, config)).toThrow(/WEB_ORIGIN/);
    });

    it.each([['https://www.novaair.example'], ['https://localhost.example.com'], ['https://novaair.example:8443']])(
      'accepts legitimate public origin %p in production',
      (origin) => {
        const { adapter } = createFakeAdapter();
        const config = new ConfigService({ NODE_ENV: 'production', WEB_ORIGIN: origin });
        expect(() => new MailService(adapter, config)).not.toThrow();
      },
    );

    it('does not validate WEB_ORIGIN outside production', () => {
      const { adapter } = createFakeAdapter();
      expect(() => new MailService(adapter, new ConfigService({ NODE_ENV: 'development' }))).not.toThrow();
      expect(() => new MailService(adapter, new ConfigService({}))).not.toThrow();
    });
  });
});
