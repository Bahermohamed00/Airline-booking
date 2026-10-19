# Project Setup Guide

Lufthansa-inspired airline booking platform (educational project).

## Prerequisites

- **Node.js** ≥ 22
- **npm** ≥ 10
- **PostgreSQL** ≥ 16 installed locally (Windows installer from postgresql.org or your package manager)
- **pgAdmin 4** (optional) — GUI for administering the local PostgreSQL server

> **Docker is NOT required to run this project.** The application connects directly to a
> PostgreSQL server running on the host machine (`localhost:5432`). pgAdmin 4 is only a
> database administration GUI — the app never connects through it.

## 1. Install dependencies

```bash
npm install
```

## 2. Set up PostgreSQL (local)

Make sure the PostgreSQL service is running, then create the application user and databases:

```powershell
# Create the application user and databases (run as the postgres superuser)
psql -U postgres -h localhost -c "CREATE USER airline WITH PASSWORD 'airline' CREATEDB;"
psql -U postgres -h localhost -c "CREATE DATABASE airline_booking OWNER airline;"
psql -U postgres -h localhost -c "CREATE DATABASE airline_booking_test OWNER airline;"
```

You can do the same from **pgAdmin 4**: connect to your local server, create the `airline`
login role, then create the `airline_booking` and `airline_booking_test` databases owned by it.

## 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` if your PostgreSQL runs on a different host/port or uses different credentials.

## 4. Generate Prisma client and run migrations

```bash
npm run db:generate
npm run db:migrate
```

For the test database (required for e2e tests):

```bash
DATABASE_URL=postgresql://airline:airline@localhost:5432/airline_booking_test?schema=public npx prisma migrate deploy --schema=prisma/schema
```

## 5. Seed the database

```bash
npm run db:seed
```

This creates demo users, roles, permissions, airports, aircraft, routes, flights, fares, and a sample booking.

## 6. Start the applications

Open two terminals:

```bash
# Terminal 1 — API (NestJS)
npm run api:dev
# API listens on http://localhost:3000/api

# Terminal 2 — Web (Angular)
npm run web:dev
# Web listens on http://localhost:4200
```

## 7. Run tests

```bash
# Unit tests (no database required)
npm run api:test

# E2E tests (requires airline_booking_test database)
npm run api:test:e2e

# Angular tests
npm run web:test
```

## Demo credentials

| Role      | Email                    | Password     |
|-----------|--------------------------|--------------|
| Admin     | `admin@airline.local`    | `Admin123!`  |
| Customer  | `customer@example.com`   | `Customer123!` |

## Useful scripts

| Command | Description |
|---------|-------------|
| `npm run db:migrate` | Apply new Prisma migrations in development |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:seed` | Seed demo data |
| `npm run db:reset` | Drop and recreate database (destructive) |
| `npm run api:dev` | Start NestJS in watch mode |
| `npm run api:build` | Build NestJS API |
| `npm run web:dev` | Start Angular dev server |
| `npm run web:build` | Build Angular app |

## Stripe webhooks in local development

With `PAYMENT_PROVIDER=stripe`, payment success is confirmed by Stripe's
**signed webhook**, not by the browser. Stripe must be able to POST to the
API's webhook route (`@Controller('payments')` + `@Post('webhook')` under the
global `api` prefix → `POST /api/payments/webhook`), so in local development
you must run the Stripe CLI forwarder in a separate terminal:

```bash
stripe listen --forward-to http://localhost:3000/api/payments/webhook
```

- The CLI prints a **fresh webhook signing secret (`whsec_…`) for each
  session**. Copy it into the API `.env` as `STRIPE_WEBHOOK_SECRET` and
  restart the API whenever it changes — a mismatch makes every webhook fail
  signature verification (HTTP 400, `webhook signature verification failed`
  in the API logs). Keep it out of version control.
- Use Stripe **test-mode** keys only (`sk_test_…` / `pk_test_…`) and test
  cards (e.g. `4242 4242 4242 4242`, any future expiry/CVC).
- Without the forwarder, a paid Stripe PaymentIntent is NOT written back
  immediately: the booking stays PENDING until the on-demand reconciliation
  (customer page recovery poll) or the scheduled sweep (payments idle ≥ 5
  minutes) retrieves the intent from Stripe. The UI still settles
  automatically — just seconds-to-minutes slower instead of instantly.

## Production runtime configuration

Production builds never bake in an API address. The Angular app loads
`config.json` from the web root at bootstrap (before the first component
renders) and **refuses to start** when it is missing, invalid, points at a
local host, or is not HTTPS.

Supply it per environment at deploy time — place a file next to `index.html`
(in the published `dist/web/browser/` output) containing:

```json
{ "apiBaseUrl": "https://<your-api-host>/api" }
```

Rules enforced by `apps/web/src/app/core/config/runtime-config.ts`:

- `apiBaseUrl` must be an absolute URL ending in `/api` (the NestJS global
  prefix, see `apps/api/src/main.ts`).
- Production requires `https://` and rejects localhost/loopback hosts.
- The checked-in `apps/web/public/config.json` holds the local-development
  value (`http://localhost:3000/api`) so `ng serve` keeps working; a
  production deployment MUST replace it — otherwise the app fails startup
  loudly instead of silently targeting localhost.
- Serve `config.json` with `Cache-Control: no-store` (or a short `max-age`)
  so a stale API address is never retained after a deployment. The app also
  fetches it with `cache: 'no-store'`.

The production Stripe **publishable** key (`pk_live_…`) is supplied separately
via `environment.prod.ts` at build time by the deploy pipeline. Server-side
payment secrets belong only in API environment variables — never in frontend
assets.

## Troubleshooting

**Migration fails with connection error**
- Verify PostgreSQL is running and `.env` `DATABASE_URL` is correct.
- Ensure the `airline` user exists and owns the databases.

**Tests fail with module resolution errors**
- Run `npm install` again to ensure workspaces are linked correctly.
- If NestJS packages were previously installed with different versions, run `npm install` to dedupe.

**Angular dev server port conflict**
- Change the port with `ng serve --port 4201` or edit `apps/web/package.json` start script.

**Prisma client not found**
- Run `npm run db:generate` after any schema change.
