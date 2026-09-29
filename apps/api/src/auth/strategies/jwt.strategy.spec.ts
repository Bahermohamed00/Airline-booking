import { describe, it, expect } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import { JwtStrategy } from './jwt.strategy.js';

describe('JwtStrategy', () => {
  it('fails fast when JWT_SECRET is not configured', () => {
    // Remove JWT_SECRET from the environment to prove fail-fast construction.
    const existing = process.env['JWT_SECRET'];
    delete process.env['JWT_SECRET'];
    try {
      const config = new ConfigService({});
      expect(() => new JwtStrategy(config, {} as PrismaService)).toThrow(/JWT_SECRET/);
    } finally {
      if (existing !== undefined) process.env['JWT_SECRET'] = existing;
    }
  });
});
