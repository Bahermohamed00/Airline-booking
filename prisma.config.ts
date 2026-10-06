// Prisma 6.19.3 skips .env loading when a config file is present ("Prisma
// config detected, skipping environment variable loading"), so load it here —
// the datasource url in prisma/schema/schema.prisma reads env("DATABASE_URL").
// dotenv is already installed (hoisted via @nestjs/config); declaring it in the
// root package.json is recommended but that file is shared-owned (see report).
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma CLI configuration (Prisma 6.19.3).
 *
 * This repository uses a multi-file schema: `prisma/schema/` holds one
 * `.prisma` file per model with `prisma/schema/schema.prisma` as the
 * generator/datasource entrypoint.
 *
 * The authoritative migration history lives in `prisma/migrations/`.
 * Without this file, Prisma 6.19.3 resolves the migrations directory as
 * `<schema folder>/migrations` (i.e. `prisma/schema/migrations`), which made
 * `migrate status`/`migrate deploy` silently see zero migrations while
 * `prisma/migrations/` held the real history. `migrations.path` pins the
 * intended directory explicitly.
 */
export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
  },
});
