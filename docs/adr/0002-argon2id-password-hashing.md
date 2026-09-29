# Argon2id for password hashing

Passwords are hashed with Argon2id (`@node-rs/argon2`, OWASP parameters m=19 MiB, t=2, p=1), replacing bcryptjs. During a migration window, legacy `$2b$` bcrypt hashes are still verified and transparently rehashed to Argon2id on the next successful login, so no forced password reset is needed; once the database is Argon2-only, bcryptjs and the legacy branch are removed (the only bcrypt hashes ever issued came from the seed).

High-entropy one-time tokens (refresh, email verification, password reset) are deliberately NOT Argon2-hashed: they are 256-bit random values, so SHA-256 is sufficient and keeps lookup a constant-time-indexed equality read.

## Consequences

- `@node-rs/argon2` chosen over `argon2` for prebuilt N-API binaries (no node-gyp on Windows) and ESM compatibility with the API's `"type": "module"`.
