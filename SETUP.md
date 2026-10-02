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
