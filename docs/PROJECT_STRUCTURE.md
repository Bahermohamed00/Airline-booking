# PROJECT_STRUCTURE.md — Project Structure & File Organization Guide

Persistent development guide for the NovaAir airline-booking monorepo.
It answers one question:

> "If I need to create a new feature, folder, component, service, DTO, test,
> Prisma migration, or shared type, exactly where should I put it?"

This document describes the repository **as it actually exists**, not an
idealized future state. Where current reality and recommendations differ,
they are labeled separately (see the Accuracy Rule at the end).

Companion docs (read these too):

- `AGENTS.md` — project instructions; mandates `best-practices.md` for Angular
  work and treats `PROJECT_OVERVIEW.md` as living documentation.
- `PROJECT_OVERVIEW.md` — living documentation: stack, schema, endpoints,
  frontend structure, change log. **Update it with every change.**
- `CONTEXT.md` — canonical domain glossary (User vs Passenger, Customer,
  Staff, Session, …). Use these terms in code, tests, and docs.
- `TRACEABILITY.md` — requirement → artifact traceability matrix, per phase.
- `best-practices.md` — Angular/TypeScript best practices (signals, OnPush,
  a11y, state).
- `docs/BACKEND.md`, `docs/FRONTEND.md` — architecture notes.
- `docs/adr/` — architecture decision records (0001–0004).
- `SETUP.md` — local setup; `setup.ps1` — setup script.

---

## 1. Project Overview

npm-workspaces monorepo. Two deployable apps plus the Prisma data layer:

```text
Airline-booking/
├── apps/
│   ├── api/                  # NestJS 11 REST API (ESM, Prisma, PostgreSQL)
│   └── web/                  # Angular 22 SPA (standalone components, signals)
├── prisma/                   # schema/ (multi-file), migrations/, seed.ts + seed/
├── docs/                     # SRS, architecture docs, ADRs, flow diagrams
├── package.json              # workspaces + root orchestration scripts
├── tsconfig.base.json        # shared strict compiler options
├── .prettierrc               # formatting
├── .env / .env.example       # environment config (never commit .env)
└── CONTEXT.md / TRACEABILITY.md / PROJECT_OVERVIEW.md / AGENTS.md
```

Responsibilities:

| Path              | Responsibility |
| ----------------- | -------------- |
| `apps/api`        | All business logic, persistence, authN/authZ, audit. The only layer that talks to the database. |
| `apps/web`        | Customer UI + Admin UI. Talks to the API over HTTP only. |
| `prisma`          | Single source of truth for the database schema, migrations, and seed data. |
| `docs`            | Requirements (SRS v2.1), architecture, ADRs, diagrams. |

Workspace configuration lives in the root `package.json`
(`"workspaces": ["apps/*", "packages/*"]`). Root scripts orchestrate the
apps: `api:dev`, `api:build`, `api:test`, `api:test:e2e`, `web:dev`,
`web:build`, `web:test`, `build`, `test`, and the `db:*` scripts.

---

## 2. Complete Folder Tree

Only folders that exist today are listed. Generated directories
(`node_modules/`, `dist/`, `.angular/`, `apps/web/dist/`)
are never edited by hand and are not expanded.

```text
apps/
├── api/
│   ├── src/
│   │   ├── main.ts                    # bootstrap; sets global prefix 'api'
│   │   ├── app.module.ts              # root module; imports all feature modules
│   │   ├── app.controller.ts / app.service.ts / app.setup.ts
│   │   ├── prisma/                    # PrismaService + PrismaModule (global DB access)
│   │   ├── common/                    # cross-module helpers (dto-transforms.ts)
│   │   ├── auth/                      # identity, sessions, RBAC (largest module)
│   │   │   ├── config/                # auth.throttles.ts
│   │   │   ├── decorators/            # @Public, @Roles, @Permissions, @CurrentUser, @Ownership
│   │   │   ├── dto/                   # login, register, password reset, MFA, …
│   │   │   ├── guards/                # auth, roles, permissions, ownership, audit-throttler
│   │   │   ├── services/              # password, session, token services
│   │   │   ├── strategies/            # jwt.strategy.ts (passport)
│   │   │   └── utils/                 # token-crypto.ts
│   │   ├── users/                     # user + staff management
│   │   │   └── dto/
│   │   ├── roles/                     # role & permission management
│   │   ├── audit/                     # audit log: events catalog, service, controller
│   │   │   └── dto/
│   │   ├── aircraft/                  # aircraft + seat maps
│   │   ├── airports/                  # airport catalog
│   │   ├── routes/                    # route catalog
│   │   ├── schedule-rules/            # schedule rules → flight generation
│   │   ├── flights/                   # public flight search/status + fare rules
│   │   │   └── dto/
│   │   ├── bookings/                  # bookings, passengers, seat holds (+ admin reads)
│   │   │   └── dto/
│   │   ├── offers/                    # public offers + admin offer management
│   │   │   └── dto/
│   │   ├── dashboard/                 # admin operations dashboard (aggregates)
│   │   │   └── dto/
│   │   └── mail/                      # notification adapter (mock/smtp)
│   └── test/                          # ALL e2e tests (*.e2e-spec.ts) + setup.ts + test-utils.ts
│
├── web/
│   ├── public/                        # static assets (favicon, assets/)
│   ├── src/
│   │   ├── main.ts / index.html / styles.scss
│   │   ├── environments/              # environment.ts, environment.prod.ts
│   │   ├── styles/
│   │   │   └── _tokens.scss           # NovaAir design tokens (--na-* palette)
│   │   └── app/
│   │       ├── app.ts / app.config.ts / app.routes.ts   # ALL routes live in app.routes.ts
│   │       ├── core/                  # singleton, app-wide infrastructure
│   │       │   ├── config/            # api-config.ts (API_CONFIG token, useRealApi flag)
│   │       │   ├── guards/            # authGuard, guestGuard, staffGuard, permissionGuard
│   │       │   ├── interceptors/      # auth.interceptor.ts
│   │       │   ├── models/            # domain.model.ts, booking-flow.model.ts
│   │       │   ├── mock/              # mock-data.ts (fallback demo data only)
│   │       │   └── services/          # auth, flight, booking, booking-draft, pricing, theme, …
│   │       ├── layouts/               # admin-shell, customer-shell, auth-layout
│   │       ├── features/
│   │       │   ├── home/              # landing page (navbar, hero, offers section, …)
│   │       │   ├── customer/
│   │       │   │   ├── auth/          # login, register, forgot/reset password, verify email
│   │       │   │   ├── booking/       # search → results → details → passengers → seats →
│   │       │   │   │                  #   extras → review → confirmation
│   │       │   │   ├── offers/        # /offers page
│   │       │   │   │   └── services/  # feature-scoped API service
│   │       │   │   ├── account/       # profile, sessions, my bookings, loyalty
│   │       │   │   ├── trips/         # manage booking, check-in, boarding pass, status, baggage
│   │       │   │   └── services/      # seat.service.ts
│   │       │   └── admin/
│   │       │       ├── dashboard/
│   │       │       ├── flights/
│   │       │       ├── catalog/       # airports, aircraft, routes
│   │       │       ├── ops/           # bookings, users, staff, roles, payments, refunds,
│   │       │       │                  #   baggage, checkin, loyalty, notifications, reports,
│   │       │       │                  #   audit, settings (admin-*.component.ts)
│   │       │       └── services/      # admin API services (users, roles, audit, catalog)
│   │       └── shared/                # reusable, UI-only building blocks
│   │           ├── ui/                # Na* components: button, badge, alert, dialog,
│   │           │                      #   data-table, skeleton, empty-state, stepper, tabs, …
│   │           ├── directives/        # has-permission.directive.ts
│   │           └── utils/             # cabin-label.ts, status-maps.ts
│   └── angular.json / package.json / tsconfig*.json
│
prisma/
├── schema/                            # multi-file schema — the ONLY place models are defined
│   ├── schema.prisma                  # generator + datasource entrypoint
│   └── <Model>/<Model>.prisma         # one file per model (37 models, 23 enums)
├── seed.ts                            # root orchestrator (idempotent, run via tsx)
├── seed/                              # domain seed modules (identity, catalog, flights, booking, offers, operations)
└── migrations/                        # generated by `prisma migrate dev` only
    ├── 20260923154042_init/
    ├── 20260924090723_auth_sessions_tokens/
    ├── 20260924123228_drop_user_reset_token_columns/
    ├── 20260924220058_audit_query_indexes/
    ├── 20260928135127_novaair_identity_cleanup/
    ├── 20260928150200_schedule_rules_flight_generation/
    ├── 20260928163000_booking_seat_holds/
    ├── 20260928174500_offers/
    └── migration_lock.toml
```

---

## 3. Backend Structure — NestJS

One folder per feature directly under `apps/api/src/<feature>/`. Flat
modules use the `<feature>.<role>.ts` naming pattern; the large `auth`
module adds responsibility subfolders.

Real examples:

```text
apps/api/src/offers/
├── offers.module.ts
├── offers.controller.ts            # public endpoints
├── admin-offers.controller.ts      # admin CRUD: @Controller('admin')
├── offers.service.ts
└── dto/
    └── *.dto.ts                    # create/update offer, admin query

apps/api/src/auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── auth.service.spec.ts            # unit tests sit beside the source file
├── config/auth.throttles.ts
├── decorators/public.decorator.ts  # @Public(), @Roles(), @Permissions(), …
├── dto/login.dto.ts                # one class per file, *.dto.ts
├── guards/permissions.guard.ts     # + *.guard.spec.ts beside each guard
├── services/token.service.ts
├── strategies/jwt.strategy.ts
└── utils/token-crypto.ts

apps/api/src/flights/
├── flights.module.ts
├── flights.controller.ts           # public endpoints
├── flights.service.ts
├── admin-catalog.controller.ts     # admin endpoints: @Controller('admin')
├── admin-catalog.service.ts        # airports/aircraft/routes CRUD
├── fare-rules.ts                   # domain constants/helpers, no DI
├── flight-response.mapper.ts       # entity → response mapping
└── dto/*.dto.ts
```

Responsibilities:

| Artifact   | Responsibility |
| ---------- | -------------- |
| `*.module.ts`     | Wires controllers/providers. Imported once in `app.module.ts`. |
| `*.controller.ts` | HTTP layer only: routing, guards, decorators, DTO validation. No business logic. Public endpoints use `@Public()` + `@Throttle()`; admin endpoints use permission/role guards. |
| `*.service.ts`    | All business logic and all Prisma access via `PrismaService`. |
| `dto/*.dto.ts`    | Request/response validation with `class-validator` decorators. |
| `*.guard.ts`      | Authorization. Guards live in `auth/guards/`; enforcement is always server-side. |
| `*.decorator.ts`  | Metadata markers (`@Public`, `@Permissions`, `@CurrentUser`, …) in `auth/decorators/`. |
| `*.mapper.ts` / `*-rules.ts` | Plain helper modules inside the feature folder — no decorators, no DI. |
| `*.strategy.ts`   | Passport strategies (`auth/strategies/`). |
| `audit-events.ts` | Central catalog of audit event names (append-only — never rename historical events). |
| `*.spec.ts`       | Vitest unit test, colocated with the file it tests. |

Two controller patterns exist, both valid:

1. Public resource: `@Public() @Controller('offers')` → `GET /api/offers`.
2. Admin resource: `@Controller('admin')` inside the owning feature module
   (see `flights/admin-catalog.controller.ts`) → `/api/admin/...`, guarded
   by permissions. Admin endpoints for a domain belong in that domain's
   module as `admin-<name>.controller.ts` / `admin-<name>.service.ts`.

The API is ESM (`"type": "module"` in `apps/api/package.json`): **relative
imports must carry the `.js` suffix** (e.g. `import { X } from './x.js'`).

**Where should a new NestJS feature be created?**
`apps/api/src/<feature-name>/` with `<feature-name>.module.ts`,
`.controller.ts`, `.service.ts`, and `dto/` — then register the module in
`apps/api/src/app.module.ts`.

---

## 4. Backend File Creation Rules

| Artifact         | Convention                                   | Example |
| ---------------- | -------------------------------------------- | ------- |
| Module           | `apps/api/src/<feature>/<feature>.module.ts` | `offers.module.ts` |
| Controller       | `<feature>.controller.ts`                    | `offers.controller.ts` |
| Admin controller | `admin-<name>.controller.ts` in the feature  | `admin-catalog.controller.ts` |
| Service          | `<feature>.service.ts`                       | `offers.service.ts` |
| Sub-service      | `services/<name>.service.ts` (large modules) | `auth/services/token.service.ts` |
| DTO              | `<feature>/dto/<name>.dto.ts`, one class per file | `offers-query.dto.ts` |
| Guard            | `auth/guards/<name>.guard.ts`                | `permissions.guard.ts` |
| Decorator        | `auth/decorators/<name>.decorator.ts`        | `public.decorator.ts` |
| Helper/constants | `<name>.ts` inside the feature folder        | `fare-rules.ts`, `audit-events.ts` |
| Unit test        | `<file>.spec.ts` beside the source           | `auth.service.spec.ts` |
| E2E test         | `apps/api/test/<feature>.e2e-spec.ts`        | `flights.e2e-spec.ts` |

Do NOT:

- create folders like `helpers/`, `misc/`, `shared/` inside `apps/api/src`
  (cross-module helpers go in `src/common/`, feature helpers stay in the
  feature folder);
- put Prisma queries in controllers or DTOs;
- create a second service for a responsibility an existing service owns
  (extend it instead);
- bypass the guard/decorator stack with ad-hoc `req.user` checks.

---

## 5. Frontend Structure — Angular

Angular 22, standalone components everywhere (no NgModules in app code),
signals + `ChangeDetectionStrategy.OnPush`, inline templates and inline
SCSS styles (`inlineStyleLanguage: "scss"` in `angular.json`). Routing is
centralized in `apps/web/src/app/app.routes.ts` with lazy
`loadComponent()` and functional guards.

```text
apps/web/src/app/
├── app.ts                 # root component
├── app.config.ts          # providers (router, http, interceptors, API_CONFIG)
├── app.routes.ts          # ALL routes: public, /admin/* (staffGuard), customer shell
├── layouts/               # shells with <router-outlet>: AdminShell, CustomerShell, AuthLayout
├── core/                  # app-wide singletons — imported by features, never imports features
├── features/              # routed pages, grouped by audience
└── shared/                # reusable UI-only building blocks
```

Actual conventions visible in the codebase:

- **Routed pages** are `*.component.ts` files whose class is suffixed
  `Page` (`OffersPage`, `FlightsPage`, `AdminBookingsPage`). They live
  under `features/<audience>/<domain>/`.
- **Admin pages** are named `admin-<domain>.component.ts` under
  `features/admin/ops/` (or `catalog/`, `dashboard/`, `flights/`).
- **Shared UI components** are `shared/ui/<name>.component.ts` with class
  prefix `Na` and selector `na-*` (`NaButton`, `NaEmptyState`, …).
- **API services** come in two tiers:
  - app-wide: `core/services/<name>.service.ts` (`auth.service.ts`,
    `flight.service.ts`, `booking.service.ts`);
  - feature-scoped: `features/<audience>/<domain>/services/<name>.service.ts`
    (`customer/offers/services/offers.service.ts`,
    `admin/services/users.service.ts`).
  All HTTP goes through `HttpClient` + the `API_CONFIG` token's `baseUrl`.
- **Models/types** live in `core/models/` (e.g. `domain.model.ts`,
  `booking-flow.model.ts`, and the `*-api.model.ts` HTTP mappers). The web
  keeps its own view-model types.
- **Guards**: `core/guards/auth.guard.ts` exports `authGuard`,
  `guestGuard`, `staffGuard`, and `permissionGuard('<resource>:<action>')`
  — the same permission strings the API enforces server-side.
- **Interceptors**: `core/interceptors/auth.interceptor.ts`.
- **Mock data**: `core/mock/mock-data.ts` exists only as a fallback when
  `useRealApi` is off. New features must call the real API.

---

## 6. Angular Feature Structure

The actual pattern for a routed feature (real example — customer offers):

```text
features/customer/offers/
├── offers.component.ts          # standalone page: inline template + inline SCSS
└── services/
    └── offers.service.ts        # feature-scoped API service
```

And for admin:

```text
features/admin/ops/
├── admin-audit.component.ts     # one page per file, flat inside the group folder
└── admin-roles.component.ts
features/admin/services/
└── audit.service.ts             # admin API services grouped under services/
```

Rules derived from this:

1. One routed page = one `*.component.ts` with inline template/styles.
   Separate `.html`/`.scss` files are NOT the current pattern.
2. A feature gets its own folder (`features/customer/offers/`) when it has
   more than one file (page + service, sub-components, …). Simple admin
   pages stay flat inside their group folder (`ops/`).
3. Register the route in `app.routes.ts` under the right shell:
   - public/customer pages → `CustomerShell` children;
   - admin pages → `AdminShell` children with
     `canActivate: [permissionGuard('<resource>:<action>')]`.
4. Admin navigation entries also go in `features/admin/admin-nav.ts`.
5. Compose pages from `shared/ui/*` components; do not restyle one-off
   buttons/badges/tables per page.

---

## 7. Angular File Rules

| I have…                        | Put it in | Example |
| ------------------------------ | --------- | ------- |
| Routed page (customer)         | `features/customer/<domain>/` | `offers/offers.component.ts` |
| Routed page (admin)            | `features/admin/ops|catalog|dashboard|flights/` | `ops/admin-users.component.ts` |
| Landing-page section           | `features/home/` | `offers.component.ts` (home section) |
| App-wide API service           | `core/services/` | `flight.service.ts` |
| Feature-scoped API service     | `features/<area>/services/` or `<feature>/services/` | `admin/services/users.service.ts` |
| Reusable UI component          | `shared/ui/` | `button.component.ts` (`NaButton`) |
| Reusable directive             | `shared/directives/` | `has-permission.directive.ts` |
| Pure helper / formatting util  | `shared/utils/` | `cabin-label.ts`, `status-maps.ts` |
| Route guard / interceptor      | `core/guards/`, `core/interceptors/` | `auth.guard.ts` |
| Domain type / interface        | `core/models/` | `domain.model.ts` |
| App shell with router-outlet   | `layouts/` | `admin-shell.component.ts` |
| Environment values             | `src/environments/` | `environment.ts` |
| Design tokens / global styles  | `src/styles/_tokens.scss`, `src/styles.scss` | `--na-*` variables |

`core` vs `features` vs `shared`:

- **core** — singleton infrastructure, loaded once: services, guards,
  interceptors, models, config. Never contains components.
- **features** — routed pages and everything only they need. Never imported
  by `core` or `shared`.
- **shared** — reusable, stateless UI primitives and pure functions used by
  many features. Never talks to the API.

---

## 8. Prisma Structure

```text
prisma/
├── schema.prisma    # all models, enums, @@map/@map, indexes, relations
├── seed.ts          # all seed logic; idempotent functions (count/findFirst
│                    # guards before create); run via `npm run db:seed` (tsx)
└── migrations/      # one folder per migration, generated only by Prisma CLI
```

- Models are defined **only** in `prisma/schema.prisma`. Conventions in use:
  UUID primary keys, snake_case table/column names via `@@map`/`@map`,
  explicit indexes on lookup columns, deliberate `onDelete` behavior,
  enums mapped with `@@map`.
- Migrations are named by the CLI: `<YYYYMMDDHHMMSS>_<snake_case_name>/migration.sql`
  (e.g. `20260927163802_add_offers`).
- **Never hand-edit** files inside `prisma/migrations/`, and never edit a
  migration that has been applied anywhere.
- Seed data goes in `prisma/seed.ts` as an idempotent `seed<Domain>()`
  function wired into `main()`. Use the fictional NovaAir dataset; keep it
  deterministic where feasible.

Root scripts (run from repo root):

```text
npm run db:migrate        # prisma migrate dev  (create + apply, dev only)
npm run db:migrate:prod   # prisma migrate deploy
npm run db:generate       # prisma generate
npm run db:seed           # tsx prisma/seed.ts
npm run db:studio         # prisma studio
```

---

## 9. Database Change Workflow

```text
edit prisma/schema.prisma
        ↓
npm run db:migrate -- --name <snake_case_name>   # generates + applies migration
        ↓
npm run db:generate                              # regenerate the Prisma client
        ↓
extend prisma/seed.ts if the domain needs seed data
        ↓
update NestJS code to match
        ↓
run tests (unit + e2e against the TEST database)
        ↓
update PROJECT_OVERVIEW.md (schema section + change log) and TRACEABILITY.md
```

Hard rules:

- Application code must never `ALTER TABLE` / raw-mutate schema. All schema
  changes go through a Prisma migration.
- Never run `prisma migrate dev` / `db:reset` against anything but your
  local dev database. `db:reset` destroys data.
- If `prisma migrate status` shows migrations in the database that are not
  in `prisma/migrations/` (or vice versa), STOP and reconcile history first
  — do not paper over it with a new migration.
- Audit note (verified 2026-09-29): migration history is reconciled.
  `npx prisma migrate status` reports both the dev database
  (`airline_booking`) and the test database (`airline_booking_test`) up to
  date with the 8 migrations in `prisma/migrations/`. The earlier divergence
  (applied `20260928*` migrations missing from the tree) no longer exists.

---

## 10. Tests Structure

| Kind            | Location | Naming | Runner |
| --------------- | -------- | ------ | ------ |
| Backend unit    | beside the source file in `apps/api/src/**` | `<file>.spec.ts` | Vitest (`npm run api:test`) |
| Backend e2e     | `apps/api/test/` | `<feature>.e2e-spec.ts` | Vitest, `vitest.config.e2e.ts` (`npm run api:test:e2e`) |
| Frontend unit   | beside the source file in `apps/web/src/**` | `<file>.spec.ts` | Angular unit-test builder / Vitest (`npm run web:test`) |

Conventions in use:

- Backend unit tests are colocated: `auth.service.spec.ts` next to
  `auth.service.ts`, `permissions.guard.spec.ts` next to the guard.
- **All** backend e2e files live in `apps/api/test/` — never in `src/`.
  Shared harness: `test/setup.ts` and `test/test-utils.ts`
  (`prismaTestClient`, `resetDatabase`, request helpers).
- E2E uses a **dedicated test database**. `test/test-utils.ts` resolves
  `process.env['DATABASE_URL'] ?? postgresql://…/airline_booking_test`.
  - **Current behavior / hazard:** because Prisma auto-loads the root
    `.env`, `DATABASE_URL` may resolve to the **dev** database, and the e2e
    suite truncates every table in `beforeEach`. Before running
    `api:test:e2e`, explicitly point `DATABASE_URL` at
    `airline_booking_test`.
  - **Absolute rule:** e2e must never truncate the development database.
- E2E files run serially (`fileParallelism: false`) because they share and
  truncate one test database.
- Frontend specs are colocated (`pricing.service.spec.ts`,
  `admin-audit.component.spec.ts`, …) and run in jsdom.
- `apps/api` tests use SWC (`unplugin-swc`) so decorator metadata matches
  production.

---

## 11. Shared Packages

There is currently **no shared package**. The former `packages/shared`
(`@airline/shared`) was removed: it had zero consumers (no source imports, no
working path alias), its enums duplicated Prisma's generated enums, and its DTO
shapes did not match the actual API/web models. See
`docs/ARCHITECTURE_DECISIONS.md` for the full rationale.

Guidance going forward:

- Share a type only when **both** the API and the web app need the identical
  shape, and introduce it deliberately (with an ADR) rather than speculatively.
- Keep types feature-local otherwise: backend-only validation DTOs stay in
  `apps/api/src/<feature>/dto/`; UI-only types stay in
  `apps/web/src/app/core/models/` or the feature folder.
- The `packages/*` workspace glob is retained in the root `package.json` so a
  future, justified shared package can be added without re-tooling.
- Prisma's `@prisma/client` enums remain the single source of truth for the
  API; the web keeps its own view-model types.

Do not create new packages without an architectural reason (and an ADR).

---

## 12. Configuration Files

| File | Purpose |
| ---- | ------- |
| `.env` (root) | Real local secrets/config. **Never committed, never copied into docs.** |
| `.env.example` (root) | Documents every required variable (`DATABASE_URL`, `API_PORT`, `API_HOST`, `NODE_ENV`, `JWT_*`, `RESET_TOKEN_EXPIRES_IN`, `EMAIL_VERIFICATION_EXPIRES_IN`, `MFA_ISSUER`, `SESSION_TTL_DAYS`, `REFRESH_TOKEN_TTL_DAYS`, `PAYMENT_PROVIDER`, `NOTIFICATION_PROVIDER`, `MAIL_FROM`, `SMTP_*`) with placeholder values. Update it when adding a variable. |
| Root `package.json` | npm workspaces (`apps/*`, `packages/*`), orchestration scripts (`api:*`, `web:*`, `db:*`), shared devDeps (prisma, tsx, typescript, prettier, eslint). |
| `tsconfig.base.json` | Strict compiler options shared by convention. |
| `apps/api/tsconfig.json` / `tsconfig.build.json` | NestJS compile config: `nodenext` modules, decorators + metadata, `outDir: dist`. |
| `apps/api/nest-cli.json` | Nest CLI config. |
| `apps/api/vitest.config.ts` / `vitest.config.e2e.ts` | Unit vs e2e Vitest configs (SWC transform, serial e2e, mock mail in e2e). |
| `apps/api/oxlint.json` | API linting (`npm run lint` in `apps/api` uses oxlint). |
| `apps/web/angular.json` | Angular workspace: `@angular/build:application`, SCSS inline styles, prod file-replacement of `environment.ts`, `@angular/build:unit-test` for tests. |
| `apps/web/tsconfig.json` / `.app.json` / `.spec.json` | Angular TS configs. |
| `apps/web/src/environments/*` | Frontend environment values (non-secret). Prod swaps `environment.ts` → `environment.prod.ts`. |
| `.prettierrc` | Formatting for the whole repo (`npm run format`). |
| `.gitignore` | Excludes `node_modules`, `dist`, `.env`, build output. |

Note (current behavior): the root `package.json` has an `eslint` script but
no eslint config file exists at the root; the API is actually linted with
oxlint. Treat formatting (Prettier) + oxlint as the enforced tools.

**Secrets rule:** never paste real `DATABASE_URL` credentials, `JWT_SECRET`,
SMTP passwords, or any `.env` value into documentation, tests, or code.
Reference variable names only.

---

## 13. Naming Conventions

Verified against the repository:

| Thing | Convention | Examples |
| ----- | ---------- | -------- |
| Folders | kebab-case (mostly single-word feature names) | `offers/`, `booking/`, `core/`, `shared/` |
| TypeScript files | kebab-case with role suffix | `flight-response.mapper.ts`, `admin-catalog.service.ts` |
| NestJS modules/controllers/services | `<feature>.{module,controller,service}.ts` | `offers.service.ts` |
| DTOs | `<name>.dto.ts`, one class per file | `flight-search-query.dto.ts` |
| Guards / decorators / interceptors | `*.guard.ts` / `*.decorator.ts` / `*.interceptor.ts` | `ownership.guard.ts` |
| Angular components | `<name>.component.ts`; routed pages get class suffix `Page`; admin pages prefixed `admin-` | `offers.component.ts` → `OffersPage`; `admin-staff.component.ts` |
| Shared UI components | class prefix `Na`, selector `na-*` | `NaBadge`, `na-empty-state` |
| Services (both apps) | `*.service.ts` | `booking-draft.service.ts` |
| Models/types | `*.model.ts` | `domain.model.ts`, `booking-flow.model.ts` |
| Unit tests | `*.spec.ts` colocated | `pricing.service.spec.ts` |
| E2E tests | `*.e2e-spec.ts` in `apps/api/test/` | `rbac.e2e-spec.ts` |
| Prisma migrations | `<timestamp>_<snake_case>` (CLI-generated) | `20260924220058_audit_query_indexes` |
| DB tables/columns | snake_case via `@@map`/`@map` | `@@map("seat_holds")` |
| API routes | kebab-case, global prefix `/api`; admin under `/api/admin/…` | `/api/offers`, `/api/admin/...` |
| Permissions | `<resource>:<action>` strings | `flights:manage`, `audit:read` |
| Audit events | `SCREAMING_SNAKE_CASE`, append-only catalog | `USER_REGISTERED` |

Backend relative imports include the `.js` extension (ESM).

---

## 14. "WHERE DO I PUT THIS?" Table

| I need to create…                | Put it here | Example |
| -------------------------------- | ----------- | ------- |
| NestJS feature                   | `apps/api/src/<feature>/` | `apps/api/src/offers/` |
| Controller                       | `apps/api/src/<feature>/<feature>.controller.ts` | `offers.controller.ts` |
| Admin controller for a domain    | `apps/api/src/<feature>/admin-<name>.controller.ts` with `@Controller('admin')` | `flights/admin-catalog.controller.ts` |
| Service                          | `apps/api/src/<feature>/<feature>.service.ts` | `offers.service.ts` |
| DTO                              | `apps/api/src/<feature>/dto/<name>.dto.ts` | `offers-query.dto.ts` |
| Guard / decorator                | `apps/api/src/auth/guards|decorators/` | `permissions.guard.ts` |
| Backend helper/constants         | inside the feature folder | `flights/fare-rules.ts` |
| Cross-module backend helper      | `apps/api/src/common/` | `dto-transforms.ts` |
| Backend unit test                | beside the source: `<file>.spec.ts` | `auth.service.spec.ts` |
| E2E test                         | `apps/api/test/<feature>.e2e-spec.ts` | `flights.e2e-spec.ts` |
| Angular customer feature         | `apps/web/src/app/features/customer/<domain>/` | `customer/offers/` |
| Angular admin page               | `apps/web/src/app/features/admin/ops|catalog/…/admin-<name>.component.ts` | `ops/admin-audit.component.ts` |
| Angular reusable UI component    | `apps/web/src/app/shared/ui/<name>.component.ts` | `badge.component.ts` |
| Angular app-wide API service     | `apps/web/src/app/core/services/<name>.service.ts` | `flight.service.ts` |
| Angular feature API service      | `features/<area>/(<feature>/)services/<name>.service.ts` | `offers/services/offers.service.ts` |
| Guard / interceptor (frontend)   | `apps/web/src/app/core/guards|interceptors/` | `auth.guard.ts` |
| Frontend-only type/model         | `apps/web/src/app/core/models/<name>.model.ts` | `booking-flow.model.ts` |
| Cross-app type (rare, needs ADR) | feature-local now; a future `packages/*` only with an ADR | — |
| Prisma model                     | `prisma/schema/<Model>/<Model>.prisma` (then migrate) | `model Offer` |
| Prisma migration                 | generated into `prisma/migrations/` via `npm run db:migrate -- --name …` | never handwritten |
| Seed data                        | `prisma/seed/<domain>.seed.ts` as `seed<Domain>()`, orchestrated by `prisma/seed.ts` | `seedOffers()` |
| Environment variable             | `.env` (real) + `.env.example` (placeholder) | `API_PORT` |
| Route (frontend)                 | `apps/web/src/app/app.routes.ts` | `{ path: 'offers', … }` |
| Admin nav entry                  | `apps/web/src/app/features/admin/admin-nav.ts` | — |
| Architecture decision            | `docs/adr/NNNN-<title>.md` | `0003-db-resolved-authorization.md` |

---

## 15. New Feature Workflow

1. **Identify the domain** and its canonical terms in `CONTEXT.md`.
2. **Check for an existing module/feature** that already owns the
   responsibility (Section 17). Extend before creating.
3. **Prisma**: edit `prisma/schema.prisma` if the data model changes →
   `npm run db:migrate -- --name <change>` → `npm run db:generate` → extend
   `prisma/seed.ts` (idempotent) if seed data is needed.
4. **Backend**: create/extend `apps/api/src/<feature>/` — module → DTOs →
   service → controller(s) (public and/or `admin-*.controller.ts`) → wire
   into `app.module.ts` → add permissions to the seed catalog if the
   feature is staff-managed → add audit events to `audit-events.ts` if
   mutations matter.
5. **Backend tests**: colocated `*.spec.ts` unit tests;
   `apps/api/test/<feature>.e2e-spec.ts` for HTTP behavior (against the
   **test** database).
6. **Types**: keep them feature-local (`apps/api/src/<feature>/dto/` or
   `apps/web/src/app/core/models/`); introduce a shared package only with an ADR.
7. **Frontend**: API service (core or feature-scoped) → standalone page
   component(s) under the right `features/` group → route in
   `app.routes.ts` (with `permissionGuard` for admin) → admin nav entry if
   applicable.
8. **Frontend tests**: colocated `*.spec.ts`.
9. **Verify**: `npm run api:test`, `npm run web:test`, typecheck/build both
   apps, run e2e against `airline_booking_test`.
10. **Document**: update `PROJECT_OVERVIEW.md` (mandatory per `AGENTS.md`)
    and `TRACEABILITY.md` for the current phase.

---

## 16. Anti-Patterns

Do NOT:

- put business logic in controllers — controllers are HTTP plumbing;
  logic belongs in services;
- put database/HTTP calls in Angular components — components call services;
- call Prisma from anywhere except NestJS services (`PrismaService`);
- create "convenience" folders (`utils/`, `helpers/`, `misc/`) outside the
  established `common/` (API) and `shared/utils/` (web) locations;
- duplicate an existing service, guard, or UI component — extend it;
- create a second Prisma model for a concept that already has one;
- add frontend mock data for a domain that has a real API
  (`core/mock/` is a legacy fallback, not a pattern to grow);
- bypass authorization: every non-public API route goes through the
  guard/decorator stack; admin UI routes use `permissionGuard` — and the
  server re-enforces it regardless;
- modify the database by hand or with raw SQL when a Prisma migration is
  required; never edit applied migrations;
- put secrets (DB credentials, JWT secrets, SMTP passwords) in docs, code,
  tests, or commits;
- move or rename existing files without a stated reason;
- change unrelated modules while implementing a scoped phase (Section 18);
- rename or reorder entries in `audit-events.ts` (append-only);
- create new workspace packages or introduce new dependencies without
  confirming they are needed (check `package.json` first).

---

## 17. Rules for Kimi

### Before creating a file

1. Search for an existing equivalent (`Grep`/`Glob` for the concept name,
   the domain term from `CONTEXT.md`, and likely file names).
2. Inspect the nearest existing feature that solves a similar problem
   (e.g. before adding an admin CRUD page, read
   `flights/admin-catalog.controller.ts` and `features/admin/ops/`).
3. Follow that folder/file pattern exactly — naming, suffixes, imports,
   test placement.
4. Reuse existing abstractions (`shared/ui/*`, `core/services/*`,
   guards/decorators) where appropriate.
5. Avoid duplicate concepts: one service per responsibility, one model per
   concept, one permission per action.
6. Keep the change inside the requested phase (Section 18).

### Before creating a folder

Ask: **does a folder already exist for this responsibility?**

- Yes → reuse it.
- No → create one only if the architecture requires it (new NestJS feature
  module, new multi-file Angular feature). Single-file additions belong in
  the existing group folder.

### Before creating a new abstraction

```text
Search existing code
↓
Check existing service / component / model / guard
↓
Reuse or extend if it fits
↓
Create a new abstraction only when reuse is genuinely impossible
↓
Note the decision in PROJECT_OVERVIEW.md (and docs/adr/ if architectural)
```

### Before finishing any change

- Update `PROJECT_OVERVIEW.md` (mandated by `AGENTS.md`).
- For Angular work, comply with `best-practices.md` (signals, OnPush,
  standalone, a11y).
- Never commit, run migrations, or run seeds unless the task explicitly
  asks for it.

---

## 18. Phase Isolation Rules

This project is developed in **scoped phases** (see `TRACEABILITY.md` and
`docs/KIMI_K3_IMPLEMENTATION_PROMPT.md`). Work delivered so far includes
foundation + identity/RBAC (Phases 0–1, mapped in `TRACEABILITY.md`),
security hardening, the flight search/catalog, bookings + passengers + seat
holds (Phase 4 — backend complete), offers (Phase 5 — complete: public
read-path, admin CRUD, seed, real-API frontend), and the real-data admin
operations dashboard (Phase 6A). Future phases cover payments/refunds and
the remaining admin modules.

When implementing a phase, Kimi must:

- implement **only** the requested phase's scope;
- not silently implement future phases (e.g. no payment logic while doing
  offers);
- not refactor or "improve" unrelated modules;
- not redesign architecture mid-phase;
- report deferred/out-of-scope work in the final report instead of
  implementing it;
- preserve existing working functionality — run the relevant test suites
  before declaring the phase done;
- record phase artifacts in `TRACEABILITY.md` and `PROJECT_OVERVIEW.md`'s
  change log.

---

## 19. Source of Truth

```text
PostgreSQL                 ← persisted business data lives here
    ↓ (Prisma migrations + client)
prisma/schema.prisma       ← schema definition (single source for structure)
    ↓
NestJS services            ← business rules, enforced server-side
    ↓ (REST, /api/*, DTOs validated with class-validator)
Angular services           ← thin HTTP adapters (HttpClient + API_CONFIG)
    ↓
Angular components         ← rendering + user interaction (signals)
```

Implications:

- Frontend state (signals, `BookingDraftService`, mock data) is **never**
  the source of truth for persisted business data.
- Authorization decisions are made by the **server**; frontend guards only
  hide/show navigation.
- Prices, availability, and statuses are computed/validated server-side;
  the UI displays what the API returns.
- The API's DTOs/`@prisma/client` types define the *shape* of data crossing
  the API boundary; the web maps them into its own view models.

---

## 20. Documentation Maintenance

Update `PROJECT_STRUCTURE.md` when:

- a new top-level or architectural folder is introduced
  (e.g. a new app, a new `apps/api/src/*` responsibility area);
- a module's internal structure changes significantly
  (e.g. a new sub-convention like `auth/strategies/`);
- the shared package architecture changes (new package, new consumption
  mechanism);
- the testing layout or conventions change;
- naming conventions change.

Do NOT update it for ordinary file creation that follows the patterns
already documented here.

Related living docs and when to touch them:

| Document | Update when |
| -------- | ----------- |
| `PROJECT_OVERVIEW.md` | **Every** change (per `AGENTS.md`): features, endpoints, models, deps, scripts + change-log entry. |
| `TRACEABILITY.md` | A phase delivers requirement-mapped artifacts. |
| `CONTEXT.md` | Domain language changes or a new canonical term appears. |
| `docs/adr/` | A significant, hard-to-reverse architectural decision is made. |
| `.env.example` | A new environment variable is introduced. |

---

## 21. Accuracy Rule

This document describes the repository **as it is**. Known inconsistencies
at the time of writing, kept visible on purpose:

- **Resolved (verified 2026-09-29):** the migration divergence described in
  an earlier revision no longer exists. The tree holds 8 migrations
  (`20260923*`–`20260928*`) and `npx prisma migrate status` reports both the
  dev and test databases up to date with them. The `Offer` model in the tree
  (marketing/catalog fields, `DRAFT|ACTIVE|INACTIVE|EXPIRED`) matches the
  applied `20260928174500_offers` migration.
- **Current behavior (deliberate):** the home page "Featured offers" section
  renders curated editorial data (`features/home/home.data.ts`), while
  `/offers` and `/admin/offers` use the real API. This is an explicit
  decision, not an oversight: the API `Offer` model is marketing/catalog
  data only (no prices, route codes, or cabins) per the Phase 5 isolation
  rule, so the landing-page showcase keeps its own presentation data.
- **Current behavior:** root `package.json` declares an `eslint` script but
  no eslint config exists; the API is linted with oxlint.
  **Recommended:** align the script with reality.
- **Current behavior:** e2e tests can resolve `DATABASE_URL` to the dev
  database (see Section 10). **Recommended:** hard-fail unless the URL
  points at the test database.

If you fix one of these, update this section in the same change.

---

*Last verified against the repository: branch `integration`, HEAD
`19a1b3c`. Describe reality; do not invent structure.*
