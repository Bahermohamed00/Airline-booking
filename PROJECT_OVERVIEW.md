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
│   └── shared/         Shared TS types: dto.ts, enums.ts (used across apps)
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

| Tech | Version | Purpose |
|---|---|---|
| **Angular** | 22 | SPA framework. Standalone components only (no NgModules), zoneless-style reactivity. |
| **Signals** (`signal`/`computed`/`input`/`output`/`viewChild`) | — | All component state and derived state; replaces decorators and manual change detection. |
| **RxJS** | 7.8 | Service-layer currency: HTTP calls return `Observable`s; components subscribe and write into signals. Used for debounced autocomplete (`Subject` + `debounceTime` + `switchMap`). |
| **HttpClient + interceptors** | — | API calls; `authInterceptor` attaches the bearer token to API requests when `useRealApi` is on. |
| **Angular Router** | 22 | Lazy-loaded routes (`loadComponent`), guards (`authGuard`, `guestGuard`, `staffGuard`, `permissionGuard`). |
| **Custom SCSS design system** | — | No Tailwind/Material. Design tokens as CSS custom properties (`styles/_tokens.scss`), global `na-*` utility classes, dual theme (light/dark) via `data-theme`. Reusable primitives in `shared/ui/` (prefix `na-`: button, badge, alert, skeleton, empty-state, segmented, autocomplete, route-line, toast…). |
| **Vitest + jsdom** | 4 | Unit tests (123 tests). |
| **TypeScript** | ~6.0 | Strict typing across the app. |

### Backend (`apps/api`)

| Tech | Version | Purpose |
|---|---|---|
| **NestJS** | 11 | Modular REST framework: modules/controllers/services, global `ValidationPipe` (whitelist + transform), global guards (throttle → JWT → roles → permissions → ownership). |
| **Prisma** | 6.19.3 *(installed; declared `^6.7.0`)* | Type-safe ORM. Client generated into `node_modules/.prisma/client`; `PrismaService` extends `PrismaClient` with lifecycle hooks. |
| **PostgreSQL** | ≥16 | Primary datastore (localhost:5432). |
| **@node-rs/argon2** | 2 | Password hashing (Argon2id). `bcryptjs` supported only for legacy-hash transparent rehash on login. |
| **@nestjs/jwt + passport + passport-jwt** | — | 15-min access tokens (JWT) + rotating opaque refresh tokens (hashed, single-use), cookie-based refresh. |
| **cookie-parser** | 1 | Parses the refresh-token cookie (middleware in `AppModule`). |
| **helmet** | 8 | Security headers; HSTS only in production. |
| **CORS** | — | Locked to `WEB_ORIGIN` (default `http://localhost:4200`) with credentials. |
| **@nestjs/throttler** | 6 | Rate limiting: `default` (100/min) and `public-search` (30/min) profiles. |
| **@nestjs/schedule** | 5 | Cron tasks (session/token cleanup). |
| **class-validator / class-transformer** | — | DTO validation (`@Matches`, `@IsEnum`, custom `TrimString`/`NormalizeEmail`/`UppercaseIata` transforms). |
| **nodemailer** | 10 | Transactional email via `mail` module (verification, password reset). |
| **speakeasy** | 2 | TOTP MFA secrets/codes. |
| **Vitest + SWC** | — | Unit (42 tests) and e2e tests. |
| **oxlint** | — | Fast linting. |

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

| Module | Endpoints (highlights) | Auth |
|---|---|---|
| `auth` | register, login, refresh, logout, MFA, email verification, password reset | mixed (public entry points) |
| `users` | CRUD users | JWT + roles/permissions |
| `roles` | roles & permissions admin | JWT + roles |
| `audit` | audit log queries | JWT + roles |
| `mail` | mail adapter (no public routes) | — |
| `flights` | `GET /flights/airports/search?q=`, `GET /flights/destinations?from=&q=`, `GET /flights/search?from=&to=&date=&cabin=`, `GET /flights/:id` | **Public**, `public-search` throttled |
| `offers` | `GET /offers?cabin=&scope=` (only active, in-window offers on bookable flights) | **Public**, `public-search` throttled |

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

1. **Flight search** — `/search`: From autocomplete (`/flights/airports/search`, debounced 250 ms) → To shows only destinations with an active route from the origin (`/flights/destinations`) → results page queries `/flights/search` with date + cabin. Selecting a fare starts a `BookingDraft` and navigates to `/flights/:id`.
2. **Offers** — `/offers`: active offers from `GET /offers` with cabin/domestic/international filters, expiry labels ("Ends today / in N days"), original vs discounted price, baggage. **Book Now** fetches the real flight, starts a `BookingDraft` with the discounted fare (base price lowered so base+tax+fee = offer price) and enters the existing booking flow at `/flights/:id`.
3. **Auth** — JWT access token + rotating refresh-token cookie; guards protect account pages and the admin area.

---

## Scripts (root)

`api:dev` / `api:build` / `api:test` / `api:test:e2e`, `web:dev` / `web:build` / `web:test`,
`db:migrate` / `db:migrate:prod` / `db:generate` / `db:seed` / `db:studio` / `db:reset`.

---

## Change log

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
