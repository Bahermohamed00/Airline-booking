import { describe, it, expect, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MAIL_ADAPTER, ConsoleMailAdapter, SmtpMailAdapter } from './mail.adapter.js';
import { MailModule } from './mail.module.js';

describe('MailModule adapter selection', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function compileMailModule() {
    return Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), MailModule],
    }).compile();
  }

  it('selects the console adapter by default (mock provider)', async () => {
    delete process.env['NOTIFICATION_PROVIDER'];
    const module = await compileMailModule();
    expect(module.get(MAIL_ADAPTER)).toBeInstanceOf(ConsoleMailAdapter);
    await module.close();
  });

  it('selects the SMTP adapter when NOTIFICATION_PROVIDER=smtp', async () => {
    process.env['NOTIFICATION_PROVIDER'] = 'smtp';
    process.env['SMTP_HOST'] = 'smtp.example.test';
    const module = await compileMailModule();
    expect(module.get(MAIL_ADAPTER)).toBeInstanceOf(SmtpMailAdapter);
    await module.close();
  });

  it('fails fast with a clear error when SMTP_HOST is missing in smtp mode', async () => {
    process.env['NOTIFICATION_PROVIDER'] = 'smtp';
    delete process.env['SMTP_HOST'];
    await expect(compileMailModule()).rejects.toThrow(/SMTP_HOST/);
  });
});
