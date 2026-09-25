# Authentication + Authorization — Architecture & Phased Implementation Plan

Status: plan only — no code changes yet.
Audience: senior backend/security engineering.
Stack: NestJS 11, Angular 22, Prisma 6, PostgreSQL 16, Vitest.

---

## 0. Key finding

Roughly two-thirds of this system **already exists** in the repo. This plan is therefore
verify-and-harden for what exists, plus targeted builds for real gaps — not a greenfield
build. Existing architecture (ADR-0001 refresh rotation, ADR-0002 Argon2id, ADR-0003
DB-resolved authorization) is kept as-is.

---

## 1. Skills assessment (Matt Pocock skills)

Installed skills inspected at `C:/Users/ayman/.agents/skills/`.

### Selected

| Skill | Why it applies | How it will be used |
|---|---|---|
| `tdd` (+ `tests.md`, `mocking.md`) | Every phase needs tests | Red→green per vertical slice; tests only at pre-agreed seams (HTTP API via supertest against the real test DB — already this repo's pattern); mock only at system boundaries (the `MailService` adapter — already adapter-based); no implementation-coupled or tautological tests |
| `codebase-design` | Architecture phase | Module/interface/depth/seam vocabulary; deletion test applied to `AuthService` (~450 lines covering register+login+refresh+MFA+reset+verification — candidate for splitting); the interface is the test surface |
| `domain-modeling` | `CONTEXT.md` + `docs/adr/` already exist | New auth terms go into the glossary; hard-to-reverse decisions (CSRF strategy, reset-token storage, lockout policy) get ADRs 0004+ |
| `code-review` | Phase gates | Two-axis review (Standards = `best-practices.md` + Fowler smell baseline; Spec = the phase spec) on the diff before moving to the next phase |
| `implement` | Execution loop | Per phase: TDD → typecheck → targeted tests → full suite → code-review → commit |

### Deliberately not used

- `implement-spec` / `to-tickets` — needs issue-tracker + worktree machinery, too heavy here
- `improve-codebase-architecture` — HTML-report command; `codebase-design`'s vocabulary gives the same value
- `research`, `prototype`, `grilling`, `diagnosing-bugs` — no open research question, prototype, or bug
- `setup-pre-commit`, `pr`, `wizard`, `migrate-to-shoehorn`, `scaffold-exercises`, `writing-*` — not relevant to auth

---

## 2. Current state — what already exists

### Backend (`apps/api/src/auth/`)

- **Registration + Argon2id** — done. `@node-rs/argon2`, OWASP params; legacy bcrypt rehash-on-login per ADR-0002 (`password.service.ts`).
- **Login + JWT access token** — done. 15m TTL, `{sub, email, sid}` payload, timing-attack dummy hash, `EMAIL_NOT_VERIFIED` 403.
- **Refresh rotation + revocation + reuse detection** — done, strong. Opaque 256-bit tokens, SHA-256 hashes in DB, `replacedById` chain in a transaction, reuse → whole session revoked + audit, httpOnly `SameSite=Strict` cookie scoped to `/api/auth` per ADR-0001.
- **Sessions/devices** — done. List / revoke-one / logout / logout-all, userAgent + IP metadata.
- **Email verification (backend)** — done. Hashed tokens, anti-enumeration, console/SMTP mail adapter.
- **RBAC + permissions** — done. `resource:action`, `@Roles` / `@Permissions` decorators, guards, `super_admin` bypass, roles loaded per-request per ADR-0003.
- **Global `JwtAuthGuard`** as APP_GUARD with `@Public()` — done.
- **Audit logging** — done (`AuditService`, ~15 event types wired), but no query endpoint.
- **Global ValidationPipe, ownership guard, MFA TOTP (speakeasy)** — done (MFA backup codes missing despite DB column).
- **Rate limiting** — partial. `@nestjs/throttler` global 100/60s; no per-endpoint auth limits; disabled under `NODE_ENV=test` so e2e never exercises it.
- **E2E suite** — good foundation. 32 e2e + 31 unit tests, Vitest + supertest + real Postgres test DB.

### Frontend (`apps/web`)

- `AuthService` with memory-only access-token signal + single-flight refresh, 401-retry interceptor, `authGuard` / `staffGuard` / `permissionGuard` — all exist.
- **But everything runs in mock mode**: `useRealApi: false`, no prod environment file.

### Explicit gaps / broken items (the real work)

1. Password-reset token is `console.log`'d, not emailed (`auth.service.ts:307-309`); `MailService.sendPasswordResetEmail` is dead code.
2. `resetPassword` uses `findFirst` on any unexpired token → wrong-user bug (`auth.service.ts:323-327`); the dedicated `PasswordResetToken` model exists but is unused (reset state lives on `User` columns instead).
3. No change-password endpoint; the profile page fakes it with a toast; frontend MFA verify is also fake.
4. No helmet/security headers; CSRF relies solely on `SameSite=Strict` (no ADR, no Origin check).
5. Frontend: missing `/verify-email` and `/reset-password` routes (backend emails link to them), broken `/login/reset` link, `permissionGuard` never used in routes, components violate `best-practices.md` (explicit `standalone: true`, explicit `OnPush`).
6. Dead env vars (`JWT_REFRESH_EXPIRES_IN`, `RESET_TOKEN_EXPIRES_IN`), `WEB_ORIGIN` used but absent from `.env.example`, real-looking DB password committed in `.env.example`.
7. `ScheduleModule` registered but zero cron jobs (expired-token purge promised by ADR-0001 doesn't exist).
8. No admin audit-log query endpoint (the `admin-audit` UI screen exists).
9. `apps/api/dist/` is tracked in git and stale; `TRACEABILITY.md` "Known Gaps" section contradicts its own tables.

---

## 3. Target architecture

### Token strategy (keep — ADR-0001 compliant)

- Access token in **memory only** (15 min).
- Refresh token in **httpOnly `SameSite=Strict` cookie** scoped to `Path=/api/auth` (7–30 days).
- Rotation on every refresh; reuse detection revokes the whole session family.
- XSS can't read either token directly; CSRF risk minimal by cookie scoping + SameSite — to be formally recorded in an ADR.

### Module map (`apps/api`) — with seams

- `PrismaModule` (global) — DB adapter behind `PrismaService`.
- `AuditModule` (global) — `AuditService.log(...)`; deep module, stays.
- `MailModule` — `MailService` seam with Console/SMTP adapters (the one mockable boundary in tests).
- `AuthModule` — controllers stay thin; split the fat `AuthService` along existing seams: `PasswordService`, `TokenService`, `SessionService` (already exist), plus a new **`PasswordResetService`** (deletion test: removing reset logic from `AuthService` concentrates ~150 lines in one place, so it earns its module).
- `UsersModule` — admin CRUD (exists); add self-service change-password.
- Guards: global `ThrottlerGuard` → global `JwtAuthGuard` → per-route `RolesGuard` / `PermissionsGuard` / `OwnershipGuard`. One authorization pipeline, no duplication.

### Angular

`AuthService` (signal state + single-flight refresh) → `auth.interceptor` (attach bearer, refresh-and-retry once on 401) → functional guards (`authGuard`, `staffGuard`, `permissionGuard`) → `naHasPermission` directive for template-level hiding. Real-API mode becomes the default; mock mode stays behind the env flag only if wanted for demos.

---

## 4. Phased plan

Status labels: **VERIFY** = exists, confirm with tests/review. **FIX** = exists but broken. **BUILD** = genuinely new.

### Phase 1 — Architecture + database design (VERIFY + small decisions)

- **Files**: `docs/adr/0004-csrf-strategy.md`, `0005-password-reset-token-storage.md`, `0006-brute-force-policy.md` (new); `CONTEXT.md`, `TRACEABILITY.md` (glossary + stale-section fixes); `.env.example` (scrub password, remove dead vars, add `WEB_ORIGIN`); `.gitignore` + `git rm -r --cached apps/api/dist` (untrack build output).
- **Why**: record irreversible security decisions; remove a committed credential; stop tracking build artifacts.
- **DB**: one real migration — move reset state from `User.resetToken` / `resetTokenExpiresAt` columns to the existing unused `PasswordResetToken` model (mirrors `EmailVerificationToken`, allows multiple outstanding tokens, kills the `findFirst` bug by design: look up by `tokenHash` directly). Alternative: drop the model — see D1.
- **Security**: documents the CSRF model; removes committed credential.
- **Tests**: none (docs/config only).
- **Verify**: `npm run db:migrate` applies clean; ADRs reviewed; `git ls-files apps/api/dist` empty.

### Phase 2 — Registration + password hashing (VERIFY)

- **Files**: none expected; possibly extra cases in `password.service.spec.ts` / `auth.service.spec.ts`.
- **Why**: Argon2id + bcrypt-rehash-on-login already implemented per ADR-0002.
- **Tests** (seams: service + HTTP): hash format is Argon2id; legacy bcrypt verifies and triggers rehash; duplicate email → 409 without leaking which field; weak password → 400.
- **Verify**: `npm run api:test` green; review against spec via `code-review`.

### Phase 3 — Login + access token (VERIFY)

- **Files**: `auth.service.ts` only if review finds issues.
- **Tests**: wrong password and unknown email take similar time and return identical 401 (dummy-hash path); unverified email → 403 `EMAIL_NOT_VERIFIED`; MFA-enabled login without code → `mfaRequired`; token TTL matches `JWT_EXPIRES_IN`.
- **Verify**: e2e `auth.e2e-spec.ts` green + any new cases.

### Phase 4 — Refresh rotation + revocation (VERIFY + small BUILD)

- **Files**: `apps/api/src/auth/token-cleanup.service.ts` (new cron using the already-registered `ScheduleModule` — purges expired/revoked `RefreshToken` + expired `Session` rows, fulfilling ADR-0001's promise).
- **Tests**: existing `auth-refresh.e2e-spec.ts` covers rotation/reuse; add unit test that purge deletes only expired rows (seam: service against test DB).
- **Verify**: `api:test` + `api:test:e2e` green.

### Phase 5 — Sessions/devices (VERIFY)

- **Existing**: list / revoke / logout-all, ownership-guarded delete, `auth-sessions.e2e-spec.ts` (8 tests).
- **Tests to add only if missing**: revoking another user's session → 404 (no existence leak); `lastUsedAt` updates on rotation.
- **Verify**: e2e green.

### Phase 6 — Angular authentication integration (BUILD — biggest frontend phase)

- **Files**: `apps/web/src/environments/environment.ts` + new `environment.prod.ts` with fileReplacement in `angular.json` (default to real API); `auth.service.ts` (delete or quarantine mock branches, add `changePassword`, real MFA verify); `app.routes.ts` (add `/verify-email`, `/reset-password`, use `permissionGuard` on admin child routes); `login.component.ts` (fix `/login/reset` link → `/reset-password`); `profile.component.ts` (wire change-password + MFA to API); fix `standalone: true` / explicit `OnPush` violations in every touched file per `best-practices.md`.
- **Why**: frontend currently 100% mock; backend emails point to routes that don't exist.
- **Security**: tokens never touch `localStorage`; interceptor keeps single-flight refresh; admin login becomes credential-based.
- **Tests**: `auth.service.spec.ts` real-API branch via `HttpTestingController`; interceptor: 401 → refresh → retry once, refresh failure → logout; guard tests (`authGuard` redirects, `permissionGuard` allows/denies).
- **Verify**: `npm run web:test` green; manual: `api:dev` + `web:dev` → register → verify → login → refresh → logout in a real browser.

### Phase 7 — NestJS authentication guards (VERIFY / consolidate)

- **Files**: `auth.controller.ts`, `users.controller.ts` (remove redundant `@UseGuards(JwtAuthGuard)` where the global guard already applies); document guard ordering.
- **Tests**: `guards.spec.ts` exists; add: `@Public()` route reachable without token; non-`@Public()` route → 401 without token.
- **Verify**: unit + e2e green; code-review gate.

### Phase 8 — RBAC (VERIFY + possible BUILD)

- **Existing**: 6 seeded roles, `@Roles`, per-request role resolution (ADR-0003).
- **Gap to scope**: the `admin-roles` UI screen exists but there are no role-management endpoints — if wanted, add minimal `RolesController` (list roles, assign/revoke role) guarded by `users:*` permissions. Confirm scope before building (D4).
- **Tests**: `rbac.e2e-spec.ts` (6 tests) + any new endpoint tests.
- **Verify**: e2e green.

### Phase 9 — Permissions (VERIFY)

- **Existing**: `resource:action` catalog, `PermissionsGuard` (ALL-of semantics), super-admin bypass.
- **Tests**: permission denied → 403 with generic body; bypass works; unknown permission in metadata fails closed.
- **Verify**: e2e green; frontend `permissionGuard` usage (Phase 6) matches backend catalog exactly (single source: `prisma/seed.ts`).

### Phase 10 — Email verification (backend done; BUILD frontend)

- **Files**: `apps/web/.../verify-email.component.ts` (new route/page consuming `?token=`), resend-verification wiring; backend unchanged except possibly resend throttling.
- **Security**: keep anti-enumeration responses; invalidate outstanding tokens on re-issue (already done).
- **Tests**: e2e exists (`auth-verification.e2e-spec.ts`); add component test for success / expired-token states.
- **Verify**: full loop in browser with console mail adapter.

### Phase 11 — Password reset / change (FIX + BUILD — main backend phase)

- **Files**: new `password-reset` submodule (or providers under `auth/`): `PasswordResetService` — request: hash token into `PasswordResetToken`, send via `MailService` (kills the `console.log`); confirm: lookup by `tokenHash`, mark `usedAt`, revoke all sessions. `POST /auth/password/change` (authenticated: verify current password, Argon2id rehash, revoke all other sessions, audit `PASSWORD_CHANGED`). Frontend reset page + profile wiring from Phase 6.
- **DB**: uses the Phase 1 migration; honor `RESET_TOKEN_EXPIRES_IN` (currently dead, hardcoded 1h).
- **Security**: anti-enumeration on request; single-use tokens; session invalidation on reset/change; audit both.
- **Tests** (TDD, seam = HTTP): request always returns 200; valid token resets and old sessions die; reused/expired token → 400; change-password wrong current → 400/401; change-password revokes other sessions but keeps current.
- **Verify**: new `auth-password.e2e-spec.ts` green; code-review gate.

### Phase 12 — Rate limiting + brute-force protection (BUILD)

- **Files**: `app.module.ts` / `auth.controller.ts` — `@Throttle` on login/register/refresh/reset-request/verify-resend (e.g. 5/min/IP for login); optional per-account progressive lockout (D2 — needs `User.failedLoginAttempts` / `lockedUntil` columns or a table); enable throttler in test env with a high ceiling so one dedicated e2e file can exercise a low limit.
- **Security**: 429 with generic body + `Retry-After`; audit `AUTH_RATE_LIMITED`; keep timing-attack dummy hash.
- **Tests**: e2e — N+1 login attempts → 429; lockout (if adopted) blocks even correct password until expiry.
- **Verify**: throttler-enabled e2e file green.

### Phase 13 — Audit logging (BUILD small)

- **Files**: `apps/api/src/audit/audit.controller.ts` (admin-only paginated query endpoint, guarded by `audit:read`-style permission); wire the existing `admin-audit` UI to it; add `PASSWORD_CHANGED`, `AUTH_RATE_LIMITED` events.
- **Security**: endpoint admin-guarded; never log tokens/passwords (verify metadata payloads).
- **Tests**: e2e — performing login/reset/change produces queryable rows; non-admin → 403.
- **Verify**: e2e green + admin UI shows entries.

### Phase 14 — Security hardening (BUILD)

- **Files**: `main.ts` (helmet with CSP, tightened CORS from `WEB_ORIGIN`, Origin-header check middleware for cookie routes per ADR-0004); new global `HttpExceptionFilter` (consistent error shape, no stack traces, strip internals from 500s); `package.json` adds `helmet` (the only new dependency — everything else already installed).
- **Tests**: e2e — security headers present; 500 responses leak nothing; CORS preflight from disallowed origin rejected; no endpoint returns `passwordHash`, `mfaSecret`, or token hashes (serialization test).
- **Verify**: e2e green; manual header inspection.

### Phase 15 — Integration / e2e completion (BUILD tests)

- **Files**: new `auth-password.e2e-spec.ts`, `auth-rate-limit.e2e-spec.ts`, `audit.e2e-spec.ts`, `security.e2e-spec.ts`; fill matrix gaps (logout-all during active refresh, verify-email token reuse, cross-user session revocation).
- **Also**: update `TRACEABILITY.md` per phase (requirement → artifact → test), fix its stale "Known Gaps".
- **Verify**: full suite — `api:test`, `api:test:e2e`, `web:test`, `lint`, both builds — all green; final `code-review` over the whole diff.

### Out of scope

Flights/bookings/payments modules (KIMI_K3 doc phases 2–5, separate work); MFA backup codes (DB column ready — optional later phase); seat-hold expiry cron (belongs with the booking module).

---

## 5. Decisions needed before Phase 1

| # | Question | Options | Recommendation |
|---|---|---|---|
| D1 | Reset-token storage | (A) migrate to dedicated `PasswordResetToken` model, drop `User.resetToken` columns; (B) drop the model, keep columns | **A** |
| D2 | Brute force | (A) IP throttling only; (B) throttling + per-account temporary lockout (small DB addition) | **A** |
| D3 | Angular mock mode | (A) delete mock branches; (B) keep behind env flag, default to real API | **B** |
| D4 | Role management | Build minimal admin role/permission CRUD for the existing `admin-roles` screen, or seed-only for now | Confirm scope |
| D5 | Execution mode | Phase-by-phase with review at each gate, or several phases autonomously | Confirm |

---

## 6. Per-phase protocol

From the `implement` / `tdd` / `code-review` skills:

1. Agree the test seams for the phase.
2. Red→green vertical slices (one test → one implementation → repeat).
3. Run targeted tests + typecheck regularly; full suite once at the end.
4. `code-review` gate: Standards (vs `best-practices.md` + smell baseline) and Spec (vs this plan).
5. Commit; update `TRACEABILITY.md`; move to next phase.

Standard verification commands:

```bash
npm run api:test          # unit (Vitest)
npm run api:test:e2e      # e2e against real test Postgres
npm run web:test          # Angular unit tests
npm run lint              # eslint
npm run api:build && npm run web:build
```
