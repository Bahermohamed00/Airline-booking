# Project Overview — NovaAir Airline Booking

> **Maintenance rule:** this file must be updated every time the project changes
> (new feature, model, endpoint, dependency, or architectural decision). It is
> enforced via `AGENTS.md`.

Lufthansa-inspired airline management & booking platform (educational project).
npm-workspaces monorepo: **Angular 22 frontend** + **NestJS 11 backend** +
**Prisma/PostgreSQL** database, with a shared types package.

Related docs: `CONTEXT.md` (domain glossary), `TRACEABILITY.md` (SRS requirement
mapping), `SETUP.md` (local setup), `docs/adr/` (architecture decisions).

---

## Repository layout

```
├── apps/
│   ├── api/            NestJS backend (REST API, port 3000, global prefix /api)
│   └── web/            Angular frontend (port 4200)
├── packages/
│   └── shared/         @airline/shared workspace pkg: plain enums/DTO types.
│                       web imports SOURCE via tsconfig paths; api imports the
│                       BUILT dist (nest rootDir can't consume outside TS) — run
│                       shared:build first (api:* scripts do it automatically).
├── tsconfig.base.json  Safe shared compiler flags (strict, skipLibCheck, …);
│                       apps keep their own tsconfigs and do not extend it yet.
├── prisma/
│   ├── schema.prisma   Single source of truth for the database
│   ├── migrations/     Migration history (5 migrations)
│   └── seed.ts         Idempotent demo-data seed
├── docs/               SRS, drawio diagrams, ADRs
├── CONTEXT.md          Canonical domain language
├── TRACEABILITY.md     SRS → implementation mapping
└── SETUP.md            Environment setup guide
```

---

## Tech stack and why each piece exists

### Frontend (`apps/web`)

| Tech                                                           | Version | Purpose                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Angular**                                                    | 22      | SPA framework. Standalone components only (no NgModules), zoneless-style reactivity.                                                                                                                                                                                                                         |
| **Signals** (`signal`/`computed`/`input`/`output`/`viewChild`) | —       | All component state and derived state; replaces decorators and manual change detection.                                                                                                                                                                                                                      |
| **RxJS**                                                       | 7.8     | Service-layer currency: HTTP calls return `Observable`s; components subscribe and write into signals. Used for debounced autocomplete (`Subject` + `debounceTime` + `switchMap`).                                                                                                                            |
| **HttpClient + interceptors**                                  | —       | API calls; `authInterceptor` attaches the bearer token to API requests when `useRealApi` is on.                                                                                                                                                                                                              |
| **Angular Router**                                             | 22      | Lazy-loaded routes (`loadComponent`), guards (`authGuard`, `guestGuard`, `staffGuard`, `permissionGuard`).                                                                                                                                                                                                   |
| **Custom SCSS design system**                                  | —       | No Tailwind/Material. Design tokens as CSS custom properties (`styles/_tokens.scss`), global `na-*` utility classes, dual theme (light/dark) via `data-theme`. Reusable primitives in `shared/ui/` (prefix `na-`: button, badge, alert, skeleton, empty-state, segmented, autocomplete, route-line, toast…). |
| **Vitest + jsdom**                                             | 4       | Unit tests (123 tests).                                                                                                                                                                                                                                                                                      |
| **TypeScript**                                                 | ~6.0    | Strict typing across the app.                                                                                                                                                                                                                                                                                |

### Backend (`apps/api`)

| Tech                                      | Version                                 | Purpose                                                                                                                                                                  |
| ----------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **NestJS**                                | 11                                      | Modular REST framework: modules/controllers/services, global `ValidationPipe` (whitelist + transform), global guards (throttle → JWT → roles → permissions → ownership). |
| **Prisma**                                | 6.19.3 _(installed; declared `^6.7.0`)_ | Type-safe ORM. Client generated into `node_modules/.prisma/client`; `PrismaService` extends `PrismaClient` with lifecycle hooks.                                         |
| **PostgreSQL**                            | ≥16                                     | Primary datastore (localhost:5432).                                                                                                                                      |
| **@node-rs/argon2**                       | 2                                       | Password hashing (Argon2id). `bcryptjs` supported only for legacy-hash transparent rehash on login.                                                                      |
| **@nestjs/jwt + passport + passport-jwt** | —                                       | 15-min access tokens (JWT) + rotating opaque refresh tokens (hashed, single-use), cookie-based refresh.                                                                  |
| **cookie-parser**                         | 1                                       | Parses the refresh-token cookie (middleware in `AppModule`).                                                                                                             |
| **helmet**                                | 8                                       | Security headers; HSTS only in production.                                                                                                                               |
| **CORS**                                  | —                                       | Locked to `WEB_ORIGIN` (default `http://localhost:4200`) with credentials.                                                                                               |
| **@nestjs/throttler**                     | 6                                       | Rate limiting: `default` (100/min) and `public-search` (30/min) profiles.                                                                                                |
| **@nestjs/schedule**                      | 5                                       | Cron tasks (session/token cleanup).                                                                                                                                      |
| **class-validator / class-transformer**   | —                                       | DTO validation (`@Matches`, `@IsEnum`, custom `TrimString`/`NormalizeEmail`/`UppercaseIata` transforms).                                                                 |
| **nodemailer**                            | 10                                      | Transactional email via `mail` module (verification, password reset).                                                                                                    |
| **speakeasy**                             | 2                                       | TOTP MFA secrets/codes.                                                                                                                                                  |
| **Vitest + SWC**                          | —                                       | Unit (42 tests) and e2e tests.                                                                                                                                           |
| **oxlint**                                | —                                       | Fast linting.                                                                                                                                                            |

### Tooling (root)

npm workspaces, `tsx` (run TS scripts like the seed), ESLint + Prettier, TypeScript 5.8.

---

## Database (Prisma schema, PostgreSQL)

Grouped models in `prisma/schema.prisma`:

- **Identity & RBAC** — `User`, `Role`, `Permission`, `UserRole`, `RolePermission`
- **Auth tokens** — `Session`, `RefreshToken`, `EmailVerificationToken`, `PasswordResetToken`
- **Passengers** — `Passenger`
- **Flight catalog** — `Airport`, `Route` (unique origin+destination), `Aircraft`, `Seat`, `SeatHold`, `Flight`, `FlightSegment`, `Fare` (unique flight+cabinClass, nullable `fareRules` JSON)
- **Offers** — `Offer` (flightId + cabinClass + discountPercentage + startsAt/endsAt + status; prices derived from the linked `Fare`, never duplicated)
- **Bookings** — `Booking`, `BookingPassenger`, `BookingSeat`
- **Payments** — `Payment`, `Refund`
- **Baggage** — `Baggage`, `BaggageEvent`
- **Check-in** — `CheckIn`, `BoardingPass`
- **Extras** — `ExtraService`, `BookingExtra`
- **Notifications** — `NotificationTemplate`, `Notification`
- **Loyalty** — `LoyaltyAccount`, `LoyaltyTransaction`
- **Audit & settings** — `AuditLog`, `SystemSetting`

---

## Backend modules & API (`/api` prefix)

| Module    | Endpoints (highlights)                                                                                                                                                          | Auth                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `auth`    | register, login, refresh, logout, MFA, email verification, password reset                                                                                                       | mixed (public entry points)                                                                 |
| `users`   | CRUD users                                                                                                                                                                      | JWT + roles/permissions                                                                     |
| `roles`   | roles & permissions admin                                                                                                                                                       | JWT + roles                                                                                 |
| `audit`   | audit log queries                                                                                                                                                               | JWT + roles                                                                                 |
| `mail`    | mail adapter (no public routes)                                                                                                                                                 | —                                                                                           |
| `flights` | Airport search (`/airports`, `/flights/airports/search`), route destinations, basic and advanced flight search, adjacent-date prices, flight status, details, and admin catalog | Public search routes are `public-search` throttled; catalog mutations require authorization |
| `offers`  | `GET /offers?cabin=&scope=` (only active, in-window offers on bookable flights)                                                                                                 | **Public**, `public-search` throttled                                                       |

Flight responses are shaped to the frontend contract: `origin`/`destination`
naming, `Decimal` prices → numbers, null `fareRules` → `DEFAULT_FARE_RULES`.

---

## Frontend structure (`apps/web/src/app`)

- **`core/`** — `config/api-config.ts` (`API_CONFIG` token, `useRealApi` flag), `models/` (domain + booking-flow types), `services/` (`auth`, `flight`, `offers`, `booking-draft`, `booking`, `pricing`, `users`, `roles`, …), `guards/`, `interceptors/`, `mock/` (fallback demo data when `useRealApi` is off).
- **`shared/ui/`** — design-system primitives (`na-*`).
- **`features/home/`** — marketing landing page (has its own static teaser sections).
- **`features/customer/`** — the customer app under `CustomerShell`:
  - `booking/` — full booking flow: `search` → `results` → `flights/:id` (details) → `booking/passengers|seats|extras|review|confirmation`
  - `offers/` — **Offers page** (`/offers`)
  - auth pages, `bookings` (manage), `checkin`, `status`, `baggage`, `loyalty`, `profile`, `help`
- **`features/admin/`** — back office under `AdminShell` (permission-guarded).

### Key user flows (real DB-backed)

1. **Flight search** — `/search`: From autocomplete (`/flights/airports/search`, debounced 250 ms) → To shows only destinations with an active route from the origin (`/flights/destinations`) → results page queries `/flights/search/advanced`; the basic `/flights/search?from=&to=&date=&cabin=` contract remains available. Adjacent-date pricing and flight-status lookups are also DB-backed. Selecting a fare starts a `BookingDraft` and navigates to `/flights/:id`.
2. **Offers** — `/offers`: active offers from `GET /offers` with cabin/domestic/international filters, expiry labels ("Ends today / in N days"), original vs discounted price, baggage. **Book Now** fetches the real flight, starts a `BookingDraft` with the discounted fare (base price lowered so base+tax+fee = offer price) and enters the existing booking flow at `/flights/:id`.
3. **Auth** — JWT access token + rotating refresh-token cookie; guards protect account pages and the admin area.

---

## Scripts (root)

`api:dev` / `api:build` / `api:test` / `api:test:e2e`, `web:dev` / `web:build` / `web:test`,
`db:migrate` / `db:migrate:prod` / `db:generate` / `db:seed` / `db:studio` / `db:reset`.

---

## Change log

- **2026-09-29 — Monorepo phase 2: shared types.** `@airline/shared` now holds
  all 21 Prisma-mirror enums (rewritten as const-object + derived union type,
  so string literals stay assignable in Angular) and 25 API-contract interfaces
  (`models.ts`: Airport/Route/Flight/Fare/FlightOffer/User/…). `JwtPayload`
  corrected to the real signed shape (`sub`, `email`, `sid`, `type`) and
  `jwt.strategy.ts` now imports it. Web `domain.model.ts` is a barrel
  re-exporting from `@airline/shared`; the 4 intentionally divergent interfaces
  (Booking, ExtraService, Payment, AuditLog + BookingExtra by dependency) stay
  web-only with audit comments. New `apps/api/src/common/shared-enums.spec.ts`
  asserts enum parity with Prisma in both directions (values + name sets).
- **2026-09-29 — Workspace/shared-package wiring (infrastructure only).**
  Root scripts: added `shared:build`, `dev:api`/`dev:web`/`build`/`test`
  aliases; `api:*` scripts now build `@airline/shared` first so fresh clones
  work. `apps/api` depends on `@airline/shared: *` (consumes built `dist/`
  because nest's `rootDir: src` cannot compile outside TypeScript); web
  tsconfigs gained `paths` → `packages/shared/src/index.ts` (source, no dist
  needed). New root `tsconfig.base.json` (safe flags only, not adopted by
  apps). `packages/*/dist/` added to `.gitignore`. Verified end-to-end with a
  throwaway constant (ng build + nest build + runtime HTTP 200), then reverted.
  NOTE: PostgreSQL credentials for user `airline` were rejected during the
  runtime check — environment issue unrelated to this wiring.
- **2026-09-29 — Frontend restructuring (pure reorganization, no logic
  changes).** `apps/web/src/app` now follows the core/shared/layouts/features
  layout: layout shells moved to `layouts/`; `has-permission` directive to
  `shared/directives/`; `status-maps` to `shared/utils/`; new shared
  `shared/utils/cabin-label.ts` replaced 4 identical local copies (home's
  marketing variant intentionally left untouched). Single-feature services
  moved into their features: `features/admin/services/` (admin-catalog, users,
  roles, audit), `features/customer/services/seat.service.ts`,
  `features/customer/offers/services/offers.service.ts`; `core/admin-nav.ts` →
  `features/admin/`. Customer pages grouped into `auth/`, `account/`, `trips/`
  subfolders. Deleted dead duplicate `core/services/auth.interceptor.ts`
  (live one is `core/interceptors/`). `seat-hold.spec.ts` stayed in
  `core/services/` because it tests `BookingDraftService`. `app.routes.ts`
  loadComponent paths updated; all imports are relative (no aliases).
  Verified: tsc clean, `ng build` clean, 123/123 tests pass. Note: root
  `npm run lint` is broken pre-existing (no eslint flat config; eslint 9).
- **2026-09-28 — Backend auth restructuring (pure reorganization, no logic
  changes).** `apps/api/src/auth` is now fully grouped by responsibility:
  `guards/` (5 guards + per-guard specs; the generic `guards.spec.ts` was split
  into `roles.guard.spec.ts` and `permissions.guard.spec.ts`), `services/`
  (password/session/token), `config/` (`auth.throttles.ts`), `utils/`
  (`token-crypto.ts`). Shared DTO transforms (`TrimString`, `NormalizeEmail`)
  moved from `auth/dto/` to the new `src/common/dto-transforms.ts`, since auth,
  users, and flights all consume them. All imports updated across `src/` and
  `test/`; no barrels added (explicit relative imports remain the convention).
- **2026-09-28 — API test tooling.** Aligned the API Vitest and coverage runner
  with the Angular workspace major version, fixed Supertest test application
  typing, narrowed successful-login assertions against the MFA result union,
  and covered both the advanced UI search route and the legacy search contract.
- **2026-09-28 — Production API configuration.** Production builds now call the
  same-origin `/api` path instead of `localhost`; deployment must proxy that path
  to NestJS. Development continues to target the local API port.
- **2026-09-28 — Shared fare rules and interceptor cleanup.** Moved cabin-specific
  fare defaults out of `FlightsService` so flight and offer responses agree, and
  removed an unused alternate auth interceptor; the registered interceptor
  remains the refresh-aware implementation.
- **2026-09-28 — Refresh-token race protection.** Rotation now claims an
  unrotated token with a conditional write in the same transaction that creates
  its replacement; a concurrent replay loses the claim and triggers the
  existing session revocation and audit path.
- **2026-09-28 — Repository hygiene.** Replaced the copied local database
  credential in tracked setup examples with the documented local fixture and
  removed an unreferenced generated repository snapshot that duplicated source.
- **2026-09-28 — UI/enhance integration.** Merged flight management, admin
  catalog, booking/search, adjacent-date pricing, and flight-status behavior
  with the existing authenticated application. Kept cookie-based refresh and
  in-memory access tokens, the auth interceptor/bootstrap restore, and active
  airport/route filtering. Combined flight endpoints under one service and
  removed accidental Markdown fences from four NestJS security source files.
- **2026-09-27 — Flight Offers feature.** New `Offer` model (migration
  `20260927163802_add_offers`), `offers` API module (`GET /api/offers` with
  cabin/scope filters, DB-side activity window), seed offers (incl. expired +
  inactive fixtures), frontend `/offers` page wired into the booking flow via
  `BookingDraftService`. Dev DB was **reset and reseeded** to resolve drift
  (unknown `fare_families` migration had been applied outside the repo).
- **2026-09-27 — Flight search/autocomplete.** New `flights` API module
  (airport search, route-valid destinations, flight search, flight detail).
  `FlightService` switched from mock to real API (mock kept behind
  `useRealApi=false`). `na-autocomplete` gained server-side mode
  (`serverSide`/`loading` inputs, `focused` output, no-matches row).
  Search page From/To are now DB-driven with debounce; To resets when From changes.
- **2026-09-26 — Dependency install + Prisma client regen.** Fixed missing
  packages (cookie-parser, helmet, nodemailer, @node-rs/argon2) and a stale
  Prisma client; killed an orphaned `dist/main` process that locked the
  query-engine DLL.
- **Earlier — Foundation & identity (Phases 0/1).** Auth (JWT + refresh
  rotation + MFA), RBAC, audit, users/roles admin, base schema. See
  `TRACEABILITY.md`.
