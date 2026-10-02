# PROJECT_OVERVIEW.md — Living Documentation

NovaAir airline booking & management platform (educational, Lufthansa-inspired SRS v2.1).
Update this file with every change: features, endpoints, models, scripts, deps —
and append to the change log. Companion docs: `PROJECT_STRUCTURE.md`
(where things go), `CONTEXT.md` (domain language), `TRACEABILITY.md`
(requirement → artifact), `SETUP.md` (local setup), `docs/adr/`.

## Stack

- **API** (`apps/api`): NestJS 11 (ESM), Prisma 6, PostgreSQL, passport-jwt,
  Argon2id (legacy bcrypt rehash on login), throttler, nodemailer, Vitest + SWC.
- **Web** (`apps/web`): Angular 22, standalone components, signals, OnPush,
  inline SCSS, split lazy routes (`app`/`admin`/`customer.routes.ts`), Vitest + jsdom.
- **Monorepo**: npm workspaces (`apps/*`, `packages/*`), orchestrated from the
  root `package.json`. (`packages/*` is retained for future shared packages; the
  unused `@airline/shared` was removed — see `docs/ARCHITECTURE_DECISIONS.md`.)

## Scripts (repo root)

| Script | Purpose |
| ------ | ------- |
| `api:dev` / `api:build` / `api:test` / `api:test:e2e` | NestJS dev server, build, unit tests, e2e tests |
| `web:dev` / `web:build` / `web:test` | Angular dev server, build, unit tests |
| `build` / `test` | api + web build / api + web unit tests |
| `db:migrate` / `db:migrate:prod` / `db:generate` / `db:seed` / `db:studio` / `db:reset` | Prisma workflows (`db:reset` destroys data — dev only) |
| `lint` | oxlint on the API workspace |
| `format` | Prettier over the repo |

## API modules & endpoints (global prefix `/api`)

| Module | Routes |
| ------ | ------ |
| `auth` | `POST /auth/register|login|refresh|logout|logout-all`, email verification, password reset, `GET/PATCH /auth/me`, `POST /auth/change-password`, sessions list/delete, MFA setup/verify/disable |
| `users` | `/users` staff/user management (permission-guarded) |
| `roles` | `/roles` role & permission catalog |
| `audit` | `/audit` audit log reads (`audit:read`) |
| `aircraft` / `airports` / `routes` | public reads + permission-guarded create/update |
| `schedule-rules` | `/schedule-rules` CRUD → flight generation |
| `flights` | `GET /flights` search, status, seat availability; `POST /flights/generate` |
| `bookings` | `POST /bookings`, own reads, `POST /bookings/:id/cancel`; admin list/detail under `/admin/bookings` |
| `payments` | customer: `POST /bookings/:id/payment`, `GET /bookings/:id/payments`; staff: `/admin/payments` (+`/:id/refund`), `/admin/refunds`, `POST /admin/bookings/:id/cancel` (BR-15 auto-refund), `POST /admin/bookings/:id/confirm-exception` (BR-14) |
| `offers` | public `GET /offers`; admin CRUD `/admin/offers` |
| `dashboard` | `GET /admin/dashboard?range=7d|30d|90d` — real aggregates (KPIs, trends, revenue) |
| `mail` | notification adapter: `mock` (console) or `smtp` via env |

Authorization: JWT access/refresh + sessions, DB-resolved roles/permissions per
request (`<resource>:<action>`), ownership guard, rate limiting with audit.
Public endpoints use `@Public()` + throttles; everything else is guarded.

## Database (prisma/)

- `schema.prisma` — single source of truth (UUID PKs, snake_case via
  `@@map`/`@map`). Domains: identity/RBAC (users, roles, permissions,
  sessions, tokens), catalog (airports, aircraft, seats, routes),
  schedule (schedule_rules, flights, flight_segments, fares), booking
  (bookings, passengers, seat_holds, booking_seats), payments (payments,
  refunds), offers, loyalty, notifications, baggage/check-in, settings, audit.
- 8 migrations (`20260923*`–`20260928*`); both `airline_booking` (dev) and
  `airline_booking_test` (e2e) are up to date.
- `seed.ts` — idempotent NovaAir dataset (permissions/roles, admin + demo
  customer, 10 airports, 4 aircraft + seat maps via the shared seat-map
  generator, 8 routes, 11 schedule rules, 14-day flight window, demo
  CONFIRMED + PENDING bookings with real invariants, loyalty, offers,
  settings).

## Frontend structure

`apps/web/src/app/`: `core/` (config, guards, interceptors, models, services,
directives), `features/` (`home/`, `customer/` booking flow + account,
`admin/` dashboard/flights/catalog/ops), `shared/` (`ui/` Na* primitives,
`utils/`). All HTTP via `HttpClient` + `API_CONFIG`; `core/mock/` is legacy
fallback only — features call the real API.

## Testing

- API unit: colocated `*.spec.ts` (Vitest, SWC for decorator metadata).
- API e2e: `apps/api/test/*.e2e-spec.ts`, serial (`fileParallelism: false`),
  harness in `test/test-utils.ts`. The harness always targets a dedicated
  `*_test` database — an ambient dev `DATABASE_URL` is rewritten to
  `airline_booking_test`; `resetDatabase()` truncates all tables per test.
- Web unit: colocated `*.spec.ts` (jsdom).

## Change log

### 2026-09-30

- Payments (Phase 6F hardening): refunds are recorded `PENDING` under a
  row-locked, remainder-validated transaction **before** the provider call,
  then marked `PROCESSED` (or `REJECTED` on provider failure) — money never
  moves without a committed DB record; `PENDING` reserves against the
  remainder. Admin cancellation marks the payment `REFUNDED` once refunds
  reach the fare-policy target (BR-15).
- E2E safety: `test/test-utils.ts` forces a `*_test` database (dev
  `DATABASE_URL` rewritten to `airline_booking_test`) — the suite previously
  resolved to the dev DB and truncated it.
- Root scripts: added `shared:build`, `build`, `test`; `lint` now delegates
  to the API's oxlint (no root eslint config exists).
- `tsconfig.base.json`: shared strict compiler options documented.
- Seed: demo bookings now carry full fare totals, fare-rules snapshots,
  BookingSeat rows and format-valid references; seat maps come from the
  shared `generateSeatMap`; demo hold lasts 24h.
- Web build: `anyComponentStyle` budget aligned to the design system
  (8 kB warn / 12 kB error); bcrypt unit tests got explicit 15 s timeouts.
- Dashboard e2e updated to the live-payments contract (numeric revenue,
  zero-filled trends).
