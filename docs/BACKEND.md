# Backend Guide — NovaAir API (apps/api)

Everything about the NestJS backend: what it does, how it's structured, and the full request lifecycle.

## 1. What it is

A **NestJS 11** REST API (ESM, TypeScript, strict mode) that is the **only security boundary** of the platform. It serves the Angular frontend over `http://localhost:3000/api`, owns all business rules and authorization, and talks to PostgreSQL exclusively through **Prisma**.

| Layer | Technology |
|---|---|
| Framework | NestJS 11 (`@nestjs/common` 11.x) |
| Language | TypeScript, ESM (`"type": "module"`, `.js` import extensions) |
| ORM | Prisma 6 (`@prisma/client`) — the only data-access layer |
| Database | PostgreSQL 18 (local install or Docker) |
| Auth | JWT (access + refresh) via `@nestjs/jwt` + `passport-jwt` |
| Validation | `class-validator` + `class-transformer` DTOs |
| Rate limiting | `@nestjs/throttler` |
| Scheduling | `@nestjs/schedule` (reserved for seat-hold expiry etc.) |
| Tests | Vitest + `unplugin-swc` + Supertest against a real test DB |

## 2. Directory layout

```
apps/api/
  src/
    main.ts                      # bootstrap (imports reflect-metadata FIRST)
    app.module.ts                # root module: wires everything
    app.controller.ts            # GET /api (health check, public)
    prisma/
      prisma.module.ts           # @Global — provides PrismaService everywhere
      prisma.service.ts          # PrismaClient subclass, connects onModuleInit
    audit/
      audit.module.ts            # @Global — provides AuditService everywhere
      audit.service.ts           # writes AuditLog rows (BR-10/BR-11)
    auth/
      auth.module.ts             # JwtModule, PassportModule, strategy, guards
      auth.controller.ts         # /api/auth/* endpoints
      auth.service.ts            # register/login/refresh/reset/MFA logic
      password.service.ts        # bcryptjs hashing (12 rounds)
      auth.guard.ts              # JwtAuthGuard (honors @Public())
      roles.guard.ts             # RolesGuard (@Roles('Super Admin'))
      permissions.guard.ts       # PermissionsGuard (@Permissions(...), super_admin bypass)
      strategies/jwt.strategy.ts # validates JWT, loads user + roles + permissions
      decorators/                # @Public, @Roles, @Permissions, @CurrentUser
      dto/                       # register, login, refresh, reset, MFA DTOs
    users/
      users.module.ts / users.controller.ts / users.service.ts
      dto/                       # create/update user DTOs
    flights/
      flights.module.ts
      flights.controller.ts      # PUBLIC endpoints (search, airports, status)
      flights.service.ts         # search/filter/sort/status logic
      admin-catalog.controller.ts# ADMIN CRUD endpoints (guarded)
      admin-catalog.service.ts   # catalog mutations + audit entries
      flight-response.mapper.ts  # Prisma rows → frontend-shaped JSON
      dto/                       # search, status, admin catalog DTOs
  test/
    setup.ts                     # imports reflect-metadata for all tests
    test-utils.ts                # test Prisma client + truncate helper
    auth.e2e-spec.ts             # auth flow e2e (real PostgreSQL)
    flights.e2e-spec.ts          # search/status/admin-auth e2e
    app.e2e-spec.ts              # smoke test
prisma/
  schema.prisma                  # 31 entities, enums, indexes, @@map/@map
  migrations/                    # version-controlled SQL migrations
  seed.ts                        # demo data (idempotent, auto-refresh)
```

## 3. Application bootstrap & startup lifecycle

1. `npm run api:dev` → `nest start --watch` (tsc watch mode, then `node dist/main`).
2. `main.ts` first imports `reflect-metadata` (required for decorator metadata used by DI and validation), then `NestFactory.create(AppModule)`.
3. Global prefix `api` is set; CORS is enabled for the Angular origin; the app listens on `API_PORT` (default 3000).
4. Nest instantiates modules in dependency order. `PrismaModule` and `AuditModule` are `@Global`, so their providers are injectable anywhere without imports.
5. `PrismaService.onModuleInit()` connects to PostgreSQL using `DATABASE_URL` from `.env` (loaded by `@nestjs/config`).

## 4. Request lifecycle (the important part)

Every HTTP request flows through this exact pipeline:

```
HTTP Request
   │
   ▼
1. ThrottlerGuard (APP_GUARD)          ← rate limiting, skipped in NODE_ENV=test
   │
   ▼
2. JwtAuthGuard (APP_GUARD)            ← global; passes @Public() routes,
   │                                      otherwise validates Bearer JWT and
   │                                      attaches AuthUser to request.user
   ▼
3. RolesGuard (APP_GUARD)              ← checks @Roles(...) metadata (role names)
   │
   ▼
4. PermissionsGuard (APP_GUARD)        ← checks @Permissions(...) metadata
   │                                      (resource:action); 'super_admin' bypasses
   ▼
5. ValidationPipe (APP_PIPE)           ← whitelist + forbidNonWhitelisted + transform;
   │                                      validates @Body/@Query/@Param against DTO
   │                                      classes; 400 on violation
   ▼
6. Controller method                   ← thin: parses params, calls service,
   │                                      never contains business rules
   ▼
7. Domain service                      ← business rules, Prisma queries,
   │                                      transactions, mapper calls
   ▼
8. PrismaClient → PostgreSQL           ← constraints/indexes enforce integrity
   │
   ▼
9. AuditService.log (when applicable)  ← AuditLog row for sensitive mutations
   │
   ▼
10. Response mapper → JSON             ← Prisma rows converted to frontend shape
                                          (Decimals → numbers, relations renamed,
                                          dates → ISO strings)
```

### 4.1 Authentication detail

- `JwtAuthGuard` extends `AuthGuard('jwt')`. It first checks `IS_PUBLIC_KEY` metadata (`@Public()` decorator) — public routes skip JWT.
- `JwtStrategy.validate()` runs on every authenticated request: it verifies the token is an *access* token, loads the user with `userRoles → role → rolePermissions → permission`, rejects non-`ACTIVE` users, and builds `AuthUser = { userId, email, firstName, lastName, roles[], permissions[] }`.
- Downstream code reads the user via the `@CurrentUser()` param decorator.

### 4.2 Authorization detail

- `@Roles('Super Admin', 'Booking Manager')` → `RolesGuard` requires any listed role name.
- `@Permissions({ resource: 'flights', action: 'manage' })` → `PermissionsGuard` requires `flights:manage` in the user's permission set. If the user has `super_admin`, every check passes (BR-09).
- Global guards run in registration order: Throttler → JWT → Roles → Permissions.

### 4.3 Validation detail

- DTOs are classes with `class-validator` decorators (`@IsEnum`, `@Length`, `@Min`, `@IsDateString`, …) and `class-transformer` `@Type(() => Number)` for query-string coercion.
- The global pipe: `whitelist: true` (strips unknown fields), `forbidNonWhitelisted: true` (rejects them), `transform: true` (coerces types).
- **Test caveat:** esbuild (Vitest default) strips `emitDecoratorMetadata`, so DTO metatypes vanish and validation silently no-ops. That's why both vitest configs use `unplugin-swc` — SWC emits decorator metadata in tests.

### 4.4 Error handling

- Domain errors throw Nest exceptions: `NotFoundException` (404), `ConflictException` (409), `BadRequestException` (400), `UnauthorizedException` (401), `ForbiddenException` (403).
- Nest's built-in exception filter serializes them to `{ statusCode, message, error }` JSON.
- Prisma `P2002` unique violations are pre-empted with explicit existence checks that raise 409s.

## 5. Modules in detail

### 5.1 AuthModule (`/api/auth/*`)

| Endpoint | Guard | Purpose |
|---|---|---|
| `POST /auth/register` | Public | Create customer (bcrypt hash, Customer role, audit `USER_REGISTERED`) |
| `POST /auth/login` | Public | Verify password (+ optional TOTP MFA code) → access+refresh tokens, audit |
| `POST /auth/refresh` | Public | Verify refresh token → new token pair |
| `POST /auth/password-reset-request` | Public | Store hashed reset token (1h expiry); identical response whether or not the email exists (anti-enumeration) |
| `POST /auth/password-reset` | Public | Verify token, rotate password, clear token |
| `POST /auth/mfa/setup` | JWT | Generate TOTP secret (speakeasy), store until verified |
| `POST /auth/mfa/verify` | JWT | Verify code → `mfaEnabled: true` |
| `POST /auth/mfa/disable` | JWT | Disable MFA, clear secret |
| `GET /auth/me` | JWT | Current user profile incl. roles/permissions |

### 5.2 UsersModule (`/api/users/*`)

Staff-facing user management: `POST/GET/GET:id/PATCH:id/DELETE:id`. Every route requires `@Roles` + `@Permissions` (users:create/read/update/delete). Delete is a **soft deactivate** (`status: DEACTIVATED`), never a hard delete — retention per GDPR NFR-10.

### 5.3 FlightsModule (Phase 2)

**Public (rate-limited with the `public-search` throttler group — 30 req/min):**

| Endpoint | Purpose |
|---|---|
| `GET /airports?query=` | Autocomplete over IATA/name/city/country |
| `GET /flights/search` | FR-C04/05/06: trip type, origin/destination, depart/return, passengers, cabin; only `SCHEDULED/ACTIVE/DELAYED` flights on the requested calendar day with an available fare in the cabin; optional `maxPrice`, `departureWindow`, `refundableOnly`, `stops`, `sort` — same filter/sort math as the frontend mock |
| `GET /flights/adjacent` | ±3-day min-price strip for the results page |
| `GET /flights/status/by-number` | FR-C19 by flight number + optional date |
| `GET /flights/status/by-route` | FR-C19 by origin/destination |
| `GET /flights/:id` | FR-C07 flight details |

**Admin (`/api/admin/*`, all behind JWT + permissions, every mutation audited):**

- `airports`: `GET/POST/PATCH/DELETE` (DELETE = deactivate) — permission `airports:manage`
- `routes`: `GET/POST/PATCH` — `routes:manage` (rejects same origin/destination, duplicate pairs → 409)
- `aircraft`: `GET/POST/PATCH` — `aircraft:manage` (creating an aircraft auto-generates its seat map)
- `flights`: `GET/POST/PATCH` — `flights:read` / `flights:manage`; create runs in a **Prisma transaction** (flight + segments + fares), validates arrival > departure, derives `scheduleStatus` from status
- `segments`: `POST /admin/flights/:id/segments`
- `fares`: `POST /admin/flights/:id/fares`, `PATCH/DELETE /admin/fares/:id`

**Response mapping:** `flight-response.mapper.ts` converts Prisma rows into the exact JSON shape the Angular models expect — `route.origin/destination` airports, `fares[].rules` (from the `fareRules` JSON column with per-cabin defaults), numeric `Decimal → number`, ISO date strings.

### 5.4 PrismaModule / AuditModule (global infrastructure)

- `PrismaService` extends `PrismaClient`; lifecycle hooks connect/disconnect with the app.
- `AuditService.log({ actorId, actorType, action, targetType, targetId, metadata, ipAddress, bookingId })` writes immutable `AuditLog` rows (BR-10/11). Used by auth events, user management, and every catalog mutation.

## 6. Database layer

- **Schema:** `prisma/schema.prisma` — 31 entities with UUID PKs, `@@map`/`@map` snake_case SQL names, enums, unique business keys (booking reference, IATA, registration, member number, tag number, provider reference), indexes for lookup paths (seat-hold expiry, booking lookups, flight status).
- **Migrations:** versioned SQL in `prisma/migrations/`. Current: `init` + `fare_families` (replaced the `@@unique(flightId, cabinClass)` with a plain index so one cabin can hold Light/Flex fare families). Apply with `npm run db:migrate` (dev) / `db:migrate:prod` (deploy).
- **Seed:** `prisma/seed.ts` — idempotent (`upsert`) demo data: permissions, roles, admin + customer users, 10 airports, 4 aircraft + generated seats, 8 routes, 14 days of flights with 3 fares each, demo booking, loyalty account, system settings. **Auto-refresh:** regenerates flights when fewer than 3 future days remain.
- **Env:** `DATABASE_URL` in `.env` (user `airline`, password `airline` on this machine; DBs `airline_booking` and `airline_booking_test`).

## 7. Testing strategy

| Suite | Command | What it covers |
|---|---|---|
| Unit | `npm run api:test` | `AuthService` (register/login rules) with mocked Prisma |
| E2E | `npm run api:test:e2e` | Full app against real `airline_booking_test` PostgreSQL: auth register/login/guard rejection, flight search (shape, empty, filters, sort, 400 validation), adjacent dates, status by number/route, admin 401 |

E2E specifics: `NODE_ENV=test` disables the throttler (it would flake tests), `PrismaService` is overridden with a client pointed at the test DB, tables are truncated between tests, and `fileParallelism: false` prevents spec files from racing on the shared database.

## 8. Configuration

`.env` (root, loaded via `@nestjs/config`): `DATABASE_URL`, `API_PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `MFA_ISSUER`, provider flags. `.env.example` documents every key.

## 9. Known gaps / next phases

- BookingsModule, PaymentsModule, OperationsModule (check-in/baggage), NotificationsModule, ReportsModule — Phases 3–5.
- Seat-hold expiry scheduler (BR-13) and flight-status sync worker (`ScheduleModule` is registered, no jobs yet).
- Multi-record transactions exist for flight creation; booking/payment transactions come with Phase 3.
- `TRACEABILITY.md` maps every implemented endpoint to SRS requirement IDs.
