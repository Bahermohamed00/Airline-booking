import { describe, it, expect, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MAIL_ADAPTER, ConsoleMailAdapter, SmtpMailAdapter } from './mail.adapter.js';
import { MailModule } from './mail.module.js';

/** Complete, valid dummy SMTP configuration — no real credentials. */
const SMTP_ENV: Record<string, string> = {
  SMTP_HOST: 'smtp.example.test',
  SMTP_PORT: '587',
  SMTP_USER: 'mail-user',
  SMTP_PASS: 'mail-pass',
  MAIL_FROM: 'NovaAir <no-reply@example.test>',
};

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

  function clearMailEnv() {
    delete process.env['NOTIFICATION_PROVIDER'];
    delete process.env['WEB_ORIGIN'];
    for (const key of Object.keys(SMTP_ENV)) {
      delete process.env[key];
    }
  }

  it('selects the console adapter by default (mock provider)', async () => {
    clearMailEnv();
    const module = await compileMailModule();
    expect(module.get(MAIL_ADAPTER)).toBeInstanceOf(ConsoleMailAdapter);
    await module.close();
  });

  it('selects the console adapter for the explicit mock provider', async () => {
    clearMailEnv();
    process.env['NOTIFICATION_PROVIDER'] = 'mock';
    const module = await compileMailModule();
    expect(module.get(MAIL_ADAPTER)).toBeInstanceOf(ConsoleMailAdapter);
    await module.close();
  });

  it('selects the SMTP adapter when NOTIFICATION_PROVIDER=smtp with full config', async () => {
    clearMailEnv();
    process.env['NOTIFICATION_PROVIDER'] = 'smtp';
    Object.assign(process.env, SMTP_ENV);
    const module = await compileMailModule();
    expect(module.get(MAIL_ADAPTER)).toBeInstanceOf(SmtpMailAdapter);
    await module.close();
  });

  it('rejects unsupported NOTIFICATION_PROVIDER values in every environment', async () => {
    for (const value of ['console', 'SMTP', 'ses', '']) {
      clearMailEnv();
      process.env['NOTIFICATION_PROVIDER'] = value;
      await expect(compileMailModule()).rejects.toThrow(/NOTIFICATION_PROVIDER/);
    }
  });

  it.each([['mock'], []])('requires NOTIFICATION_PROVIDER=smtp in production (got %p)', async (value) => {
    clearMailEnv();
    process.env['NODE_ENV'] = 'production';
    if (value) {
      process.env['NOTIFICATION_PROVIDER'] = value;
    }
    await expect(compileMailModule()).rejects.toThrow(/NOTIFICATION_PROVIDER=smtp is required/);
  });

  it('allows the SMTP adapter in production with full config and a public WEB_ORIGIN', async () => {
    clearMailEnv();
    process.env['NODE_ENV'] = 'production';
    process.env['NOTIFICATION_PROVIDER'] = 'smtp';
    process.env['WEB_ORIGIN'] = 'https://www.novaair.example';
    Object.assign(process.env, SMTP_ENV);
    const module = await compileMailModule();
    expect(module.get(MAIL_ADAPTER)).toBeInstanceOf(SmtpMailAdapter);
    await module.close();
  });

  it('fails fast with a clear error when SMTP_HOST is missing in smtp mode', async () => {
    clearMailEnv();
    process.env['NOTIFICATION_PROVIDER'] = 'smtp';
    Object.assign(process.env, SMTP_ENV);
    delete process.env['SMTP_HOST'];
    await expect(compileMailModule()).rejects.toThrow(/SMTP_HOST/);
  });

  it.each(Object.keys(SMTP_ENV))('fails fast when %s is missing in smtp mode', async (missing) => {
    clearMailEnv();
    process.env['NOTIFICATION_PROVIDER'] = 'smtp';
    Object.assign(process.env, SMTP_ENV);
    delete process.env[missing];
    await expect(compileMailModule()).rejects.toThrow(new RegExp(missing));
  });

  it('never includes configured secret values in configuration errors', async () => {
    clearMailEnv();
    process.env['NOTIFICATION_PROVIDER'] = 'smtp';
    Object.assign(process.env, SMTP_ENV);
    delete process.env['MAIL_FROM'];
    await expect(compileMailModule()).rejects.toThrow(/MAIL_FROM/);
    await expect(compileMailModule()).rejects.not.toThrow(/mail-pass/);
  });

  it.each(['abc', '0', '65536', '1.5', '587x', '0x10', ' 587 '])('rejects invalid SMTP_PORT %p', async (port) => {
    clearMailEnv();
    process.env['NOTIFICATION_PROVIDER'] = 'smtp';
    Object.assign(process.env, SMTP_ENV, { SMTP_PORT: port });
    await expect(compileMailModule()).rejects.toThrow(/SMTP_PORT must be a decimal integer between 1 and 65535/);
  });

  it.each([['1'], ['465'], ['65535']])('accepts boundary SMTP_PORT %p', async (port) => {
    clearMailEnv();
    process.env['NOTIFICATION_PROVIDER'] = 'smtp';
    Object.assign(process.env, SMTP_ENV, { SMTP_PORT: port });
    const module = await compileMailModule();
    expect(module.get(MAIL_ADAPTER)).toBeInstanceOf(SmtpMailAdapter);
    await module.close();
  });

  it.each([[undefined], ['http://localhost:4200'], ['http://127.0.0.1:4200'], ['http://[::1]:4200']])(
    'rejects loopback or missing WEB_ORIGIN in production (got %p)',
    async (origin) => {
      clearMailEnv();
      process.env['NODE_ENV'] = 'production';
      process.env['NOTIFICATION_PROVIDER'] = 'smtp';
      Object.assign(process.env, SMTP_ENV);
      if (origin) {
        process.env['WEB_ORIGIN'] = origin;
      }
      await expect(compileMailModule()).rejects.toThrow(/WEB_ORIGIN/);
    },
  );

  it('allows a missing WEB_ORIGIN outside production (localhost default)', async () => {
    clearMailEnv();
    const module = await compileMailModule();
    expect(module.get(MAIL_ADAPTER)).toBeInstanceOf(ConsoleMailAdapter);
    await module.close();
  });
});
