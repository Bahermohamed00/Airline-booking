import { Injectable } from '@nestjs/common';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import * as bcrypt from 'bcryptjs';

// OWASP-recommended Argon2id parameters (m=19 MiB, t=2, p=1).
// `algorithm` omitted: @node-rs/argon2 defaults to Argon2id, and its `Algorithm`
// const enum is incompatible with isolatedModules. The argon2id format is pinned
// by password.service.spec.ts.
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    return argonHash(password, ARGON2_OPTIONS);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    if (this.needsRehash(hash)) {
      return bcrypt.compare(password, hash);
    }
    try {
      return await argonVerify(hash, password);
    } catch {
      return false;
    }
  }

  needsRehash(hash: string): boolean {
    return hash.startsWith('$2');
  }
}
