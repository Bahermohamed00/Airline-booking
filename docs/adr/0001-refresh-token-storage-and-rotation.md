# Refresh token storage and rotation

Refresh tokens are opaque 32-byte random values (not JWTs), delivered as an `httpOnly; SameSite=Strict; Secure (prod)` cookie scoped to `Path=/api/auth`, rotated on every use, and stored only as SHA-256 hashes in `refresh_tokens`. Presenting an already-rotated token revokes the whole Session and writes a `TOKEN_REUSE_DETECTED` audit entry, treating reuse as a theft signal.

## Considered Options

- Stateless JWT refresh tokens (the previous implementation): impossible to revoke or rotate server-side, and they shared the access-token signing secret — rejected.
- Refresh token in the response body persisted in `localStorage`: simpler CORS/CSRF story, but readable by any injected script (XSS) — rejected.

## Consequences

- Angular must send `withCredentials` on `/api/auth/*` and can never read the refresh token; a page reload restores the session via a silent refresh call.
- Rotated rows must be kept until expiry so reuse can be detected; a scheduled cleanup (Phase 14) purges expired rows.
