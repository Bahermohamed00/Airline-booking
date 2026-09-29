import { describe, it, expect } from 'vitest';
import * as bcrypt from 'bcryptjs';
import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes with Argon2id and OWASP parameters', async () => {
    const hash = await service.hash('Password123!');
    expect(hash.startsWith('$argon2id$v=19$m=19456,t=2,p=1$')).toBe(true);
  });

  it('verifies a password against its own hash', async () => {
    const hash = await service.hash('Password123!');
    await expect(service.verify('Password123!', hash)).resolves.toBe(true);
    await expect(service.verify('WrongPassword!', hash)).resolves.toBe(false);
  });

  it('returns false instead of throwing for malformed hashes', async () => {
    await expect(service.verify('Password123!', 'not-a-hash')).resolves.toBe(false);
  });

  it('still verifies legacy bcrypt hashes', async () => {
    const legacyHash = await bcrypt.hash('Password123!', 12);
    await expect(service.verify('Password123!', legacyHash)).resolves.toBe(true);
    await expect(service.verify('WrongPassword!', legacyHash)).resolves.toBe(false);
  });

  it('flags bcrypt hashes for rehash, Argon2id hashes as current', async () => {
    const legacyHash = await bcrypt.hash('Password123!', 12);
    const argonHash = await service.hash('Password123!');
    expect(service.needsRehash(legacyHash)).toBe(true);
    expect(service.needsRehash(argonHash)).toBe(false);
  });

  it('produces a different hash for the same password (random salt)', async () => {
    const a = await service.hash('Password123!');
    const b = await service.hash('Password123!');
    expect(a).not.toBe(b);
  });

  it('never embeds the plaintext password in the hash', async () => {
    const hash = await service.hash('Password123!');
    expect(hash).not.toContain('Password123!');
  });
});
