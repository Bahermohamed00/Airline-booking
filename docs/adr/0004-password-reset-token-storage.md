# Password reset token storage

Password reset links carry an opaque 32-byte random token (base64url). Only its SHA-256 digest is stored, in the dedicated `password_reset_tokens` table (`token_hash`, `expires_at`, `used_at`) — the same pattern as email-verification tokens. Requesting a new link invalidates all previous unused tokens for that user, and a successful reset marks the token used in the same transaction as the password update. The `users.reset_token` / `users.reset_token_expires_at` columns were dropped (both verified empty before the migration).

## Considered Options

- Single reset token on `users.reset_token` (previous implementation): required a `findFirst` over all users holding any unexpired token followed by an Argon2id verify per candidate — a wrong-user race when multiple users have outstanding resets, at most one active token per user, and an unauthenticated endpoint paying password-KDF cost per attempt — rejected.
- Argon2id hashing of the reset token: the token already carries 256 bits of entropy, so a memory-hard KDF adds no brute-force protection and turns `POST /api/auth/password-reset` into an unauthenticated Argon2 endpoint (CPU/memory amplification) — rejected. SHA-256 digest lookup is O(1) and sufficient, as with refresh tokens (ADR-0001).

## Consequences

- Lookups are by unique `token_hash`; used or expired tokens are rejected without touching the user row.
- The schema permits multiple outstanding tokens per user, but the service enforces one active link.
- Reset links are sent via `MailService.sendPasswordResetEmail`; the raw token is no longer written to the API log.
