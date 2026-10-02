# Traceability Matrix — Phases 0–5

This document maps SRS v2.1 requirements to their implementation artifacts for the foundation, identity/RBAC, mock-data UI, bookings/seat-holds, and offers phases.

## Legend

- `FR-Cxx` — Customer functional requirement
- `FR-Axx` — Admin functional requirement (numbered from SRS Section 5)
- `BR-xx` — Business rule
- `NFR-xx` — Non-functional requirement
- `UC-xx` — Use case

## Phase 0 — Foundation

| Requirement | Use Case | UI / Screen | API / Module | Service / Guard | Prisma / PostgreSQL | Test |
|-------------|----------|-------------|--------------|-----------------|---------------------|------|
| NFR-08 Maintainability | — | Monorepo layout (`/apps/web`, `/apps/api`, `/prisma`) | `AppModule`, feature modules | Separation of concerns | Multi-file schema in `/prisma/schema/` | Repository structure review |
| Section 19.1 Tech baseline | — | Angular 22 scaffold | NestJS 11 API | Prisma ORM | PostgreSQL schema + migrations | Build tests for both apps |
| Section 19.5 Prisma design rules | — | — | — | — | UUID PKs, `@@map`/`@map`, unique constraints, indexes, deliberate cascade/restrict | Schema validation |
| Section 10 Data entities | — | — | All modules | Domain services | 31 modeled entities incl. `SeatHold` | Seed script covers core entities |
| Section 19.2 Architecture | — | Angular → API adapters | NestJS REST controllers | Domain services, integration adapters | Prisma as only data layer | — |
| NFR-12 Backup strategy | — | — | — | — | Local PostgreSQL; logical backups via `pg_dump` | — |

## Phase 1 — Identity & RBAC

| Requirement | Use Case | UI / Screen | API Endpoint / Module | Service / Guard | Prisma / PostgreSQL | Test |
|-------------|----------|-------------|-----------------------|-----------------|---------------------|------|
| FR-C01 Registration | UC-02 | Register page (future) | `POST /api/auth/register` | `AuthService.register` | `User`, `Role`, `UserRole` | `auth.service.spec.ts`, `auth.e2e-spec.ts` |
| FR-C02 Authentication | UC-02 | Login page (future) | `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `POST /api/auth/logout-all`, `GET /api/auth/sessions`, `DELETE /api/auth/sessions/:id` | `AuthService.login/refresh/logout`, `SessionService`, `TokenService` (rotation + reuse detection), `JwtStrategy` (session-bound `sid`) | `User`, `Session`, `RefreshToken` | `auth.e2e-spec.ts`, `auth-refresh.e2e-spec.ts`, `auth-sessions.e2e-spec.ts` |
| FR-C24 Account Recovery / MFA | UC-02 | Password reset / MFA setup (future) | `POST /api/auth/password-reset-request`, `POST /api/auth/password-reset`, `POST /api/auth/mfa/setup`, `POST /api/auth/mfa/verify`, `POST /api/auth/mfa/disable` | `AuthService` password reset & MFA hooks | `PasswordResetToken`, `User.mfaSecret`, `User.mfaEnabled` | Unit + E2E |
| Section 5.8 Staff, Roles & Permissions | UC-09 | Admin roles page (future) | `GET|POST|PATCH|DELETE /api/users` | `UsersService`, `RolesGuard`, `PermissionsGuard` | `Role`, `Permission`, `UserRole`, `RolePermission` | Integration tests |
| BR-08 Authorized staff only | — | — | All admin controllers | `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard` | — | Guard unit tests |
| BR-09 Super Admin full permissions | — | — | All admin controllers | `PermissionsGuard` checks `super_admin` permission flag | `Role.isSuperAdmin` | Guard tests |
| BR-10 / BR-11 Audit log | UC-12 | Audit log viewer (future) | Audited endpoints call `AuditService.log` | `AuditService` | `AuditLog` | Audit service tests |
| BR-12 Customer data isolation | — | Manage booking pages (future) | Service layer filters by `userId` | `UsersService`, future booking services | FK relationships | — |
| NFR-01 Security | — | — | Auth endpoints | `PasswordService` (Argon2id; legacy bcrypt verified + rehashed on login), JWT guards, validation pipe | Password hashes, refresh tokens stored as SHA-256 hashes, no raw card data | `password.service.spec.ts`, `auth.service.spec.ts` |
| NFR-01 Rate limiting | — | — | Global guard | `ThrottlerGuard` | — | — |
| NFR-09 Auditability | — | — | Audited endpoints | `AuditService` | `AuditLog` immutable for ordinary admins | — |

## Phase 2 (UI) — Customer portal & admin dashboard (mock-data UI)

| Requirement | UI Screen | Route | Service / Guard | Test |
|-------------|-----------|-------|-----------------|------|
| FR-C04/05/06 Search & results | SearchPage, ResultsPage | `/search`, `/results` | `FlightService.searchFlights`, `applyFilters`/`applySort` | pricing/status specs |
| FR-C07 Flight details | FlightDetailsPage | `/flights/:id` | `FlightService.getFlight` | — |
| FR-C08 Passenger data | PassengersPage | `/booking/passengers` | `BookingDraftService`, reactive form validators | — |
| FR-C09 / BR-13 Seat selection & hold | SeatsPage | `/booking/seats` | `SeatService.stateOf`, `BookingDraftService` hold expiry | `seat-hold.spec.ts` |
| FR-C10/11 Baggage & extras | ExtrasPage | `/booking/extras` | `ExtrasService`, `PricingService` | `pricing.service.spec.ts` |
| FR-C12 Fare calculation | ReviewPage breakdown | `/booking/review` | `PricingService.computeBreakdown` | `pricing.service.spec.ts` |
| FR-C13 / NFR-01 Payment (tokenized, no raw card) | ReviewPage payment | `/booking/review` | `PaymentService` mock provider + idempotency | — |
| FR-C14 Confirmation | ConfirmationPage | `/booking/confirmation` | `BookingService.confirmFromDraft` | — |
| FR-C15/16 My bookings / manage | MyBookingsPage, ManageBookingPage, ManageLookupPage | `/bookings`, `/bookings/:id`, `/manage` | `BookingService`, cancel with refund estimate | — |
| FR-C17/18 Check-in & boarding pass | CheckInPage, BoardingPassPage | `/checkin`, `/checkin/:id/pass` | `CheckInService.eligibility` (BR-07) | — |
| FR-C19 Flight status | FlightStatusPage | `/status` | `FlightService.flightStatusBy*` | — |
| FR-C20 Baggage tracking | BaggagePage | `/baggage` | `BaggageService.track` | — |
| FR-C21 Notifications | ProfilePage notifications section | `/profile/notifications` | `NotificationService` | — |
| FR-C22 Loyalty | LoyaltyPage | `/loyalty` | `LoyaltyService` | — |
| FR-C01/02/24 Registration, login, recovery, MFA | LoginPage, RegisterPage, ProfilePage security | `/login`, `/register`, `/profile/security` | `AuthService` (mock, API-switchable) | `permission.spec.ts` |
| SRS 5.1 Overview dashboard | DashboardPage | `/admin/dashboard` | `AdminService.dashboardKpis`, `naHasPermission` financial gating | `permission.spec.ts` |
| SRS 5.2–5.5 Flights/airports/aircraft/routes | FlightsPage, AirportsPage, AircraftPage, RoutesPage | `/admin/flights|airports|aircraft|routes` | mock catalog services | — |
| SRS 5.6 Booking mgmt incl. BR-14 exception | AdminBookingsPage | `/admin/bookings` | `BookingService.adminConfirmException` (reason required, audit copy) | — |
| SRS 5.7–5.8 Users, staff, roles | AdminUsersPage, AdminStaffPage, AdminRolesPage | `/admin/users|staff|roles` | `naHasPermission`, role matrix | `permission.spec.ts` |
| SRS 5.9 Payments & refunds | AdminPaymentsPage, AdminRefundsPage | `/admin/payments|refunds` | tokenization notice, CSV export | — |
| SRS 5.10–5.11 Baggage & check-in ops | AdminBaggagePage, AdminCheckInPage | `/admin/baggage|checkin` | `BaggageService`, `CheckInService` | — |
| SRS 5.12–5.13 Loyalty & notifications | AdminLoyaltyPage, AdminNotificationsPage | `/admin/loyalty|notifications` | `LoyaltyService`, notification queue | — |
| SRS 5.14 Reports | AdminReportsPage | `/admin/reports` | aggregates from mock data, CSV export | — |
| SRS 5.15 Audit log | AdminAuditPage | `/admin/audit` | immutable notice, metadata view | — |
| SRS 5.16 System settings | AdminSettingsPage | `/admin/settings` | gated `settings:manage` | `permission.spec.ts` |
| BR-08/09 Backend-enforced RBAC (UI mirrors) | role-aware shells, `RoleGuard`, `naHasPermission` | `/admin/*` | `AuthService.hasPermission`, `staffGuard` | `permission.spec.ts` |

## Phase 4 — Bookings, Passengers & Seat Holds (backend)

| Requirement | Use Case | UI / Screen | API Endpoint / Module | Service / Guard | Prisma / PostgreSQL | Test |
|-------------|----------|-------------|-----------------------|-----------------|---------------------|------|
| FR-C08 Passenger data | UC-03 | Passenger form (Phase 2 UI, mock) | `POST /api/bookings` | `BookingsService.create` (fresh `Passenger` + `BookingPassenger` per traveller, in-transaction) | `Passenger`, `BookingPassenger` (`@@unique([bookingId, passengerId])`) | `bookings.e2e-spec.ts`, `bookings.service.spec.ts` |
| BR-13 Seat hold & expiry | UC-03 | Seats page (Phase 2 UI, mock) | Holds created atomically with booking (15-min TTL, `SEAT_HOLD_MINUTES`) | `SeatHoldsService.expireStaleHolds` (`@Cron` every minute) + in-transaction self-heal | `SeatHold` (`ACTIVE/EXPIRED/CONVERTED/RELEASED`), partial unique index `seat_holds_one_active_per_flight_seat` | `bookings.e2e-spec.ts` (expiry, re-book after expire) |
| Concurrency / duplicate seat protection | — | — | `POST /api/bookings` | Defense in depth: in-request checks + P2002→409 mapping | Partial unique index on `(flight_id, seat_id) WHERE status='ACTIVE'`; `BookingSeat` `@@unique([flightSegmentId, seatId])` | `bookings.e2e-spec.ts` (two parallel creates → exactly one 201) |
| Seat validation (wrong aircraft / cabin) | — | — | `POST /api/bookings` | `BookingsService.create` → 400 | `Seat`, `Flight.aircraftId` | `bookings.e2e-spec.ts`, `bookings.service.spec.ts` |
| FR-C12 Fare-based totals | — | Review page (Phase 2 UI, mock) | Server computes total; client-supplied totals/status/reference rejected (400) | `BookingsService` (`basePrice+taxAmount+feeAmount` × passengers; `fareRulesSnapshot`) | `Fare` (`@@unique([flightId, cabinClass])`) | `bookings.e2e-spec.ts` (exact total asserted) |
| Booking lifecycle: PENDING, reference, cancellation | UC-03/05 | My bookings (Phase 2 UI, mock) | `POST /api/bookings`, `POST /api/bookings/:id/cancel` | `BookingsService.create/cancelMine`; `booking-reference.ts` (`NV` + 6, collision retry) | `Booking.status` PENDING→CANCELLED; holds RELEASED; history preserved | `bookings.e2e-spec.ts`, `booking-reference.spec.ts` |
| BR-12 Customer data isolation | — | — | `GET /api/bookings`, `GET /api/bookings/:id` | Owner-filtered queries (`userId`); cross-user → 404 | `Booking.userId` FK (Restrict) | `bookings.e2e-spec.ts` (ownership suite) |
| SRS 5.6 Admin booking reads | UC-09 | AdminBookingsPage (mock) | `GET /api/admin/bookings`, `GET /api/admin/bookings/:id` | `AdminBookingsController` `@Permissions(bookings:read)`; filters reference/status/email | — | `bookings.e2e-spec.ts` (403 for customer, filters, 404) |
| BR-10/BR-11 Audit log | UC-12 | — | Emitted post-commit, failure-isolated | `AuditService.log` | `BOOKING_CREATED`, `BOOKING_CANCELLED`, `SEAT_HELD`, `SEAT_HOLD_EXPIRED`, `SEAT_HOLD_RELEASED` in `AuditLog` | `bookings.e2e-spec.ts` (exact audit rows asserted) |
| Payment exclusion (Phase 4 scope) | — | — | No payment/refund endpoints exist | — | No `Payment`/`Refund` rows created by booking flows | `bookings.e2e-spec.ts` (0 payments/refunds asserted) |

## Phase 5 — Offers (full stack)

| Requirement | Use Case | UI / Screen | API Endpoint / Module | Service / Guard | Prisma / PostgreSQL | Test |
|-------------|----------|-------------|-----------------------|-----------------|---------------------|------|
| Customer offer catalog | UC-01 | OffersPage `/offers` (real API) | `GET /api/offers`, `GET /api/offers/:id` (`@Public`) | `OffersService.findPublic/findPublicOne` — server-side filter `ACTIVE AND validFrom <= now AND validUntil >= now`; DRAFT/INACTIVE/EXPIRED/expired/future hidden (404 on detail); public view strips internals | `Offer`, `OfferStatus`, `@@index([status, validFrom, validUntil])` | `offers.e2e-spec.ts` (visibility suite), `offers.service.spec.ts`, `offers.component.spec.ts` |
| Admin offer management | UC-09 | AdminOffersPage `/admin/offers` (real API, `permissionGuard('offers:manage')`) | `GET /api/admin/offers(/:id)` (`offers:read`), `POST/PATCH/DELETE /api/admin/offers(/:id)` (`offers:manage`); DELETE = deactivate (INACTIVE) | `AdminOffersController`, `OffersService`; class-validator DTOs (lengths, ISO dates, enum, assets/https image pattern, unknown-field rejection); duplicate title → 409 | Unique `Offer.title` | `offers.e2e-spec.ts`, `offers.service.spec.ts`, `admin-offers.component.spec.ts`, `offers.service.spec.ts` (web) |
| BR-08/09 Backend-enforced RBAC | — | UI mirrors via `permissionGuard` | All admin offer routes guarded | `JwtAuthGuard` + `PermissionsGuard`; `offers:read`/`offers:manage` seeded; Super Admin bypass | `Permission` seed catalog | `offers.e2e-spec.ts` (401 unauthenticated, 403 customer) |
| BR-10/BR-11 Audit log | UC-12 | — | Mutations audited | `AuditService.log` (fail-soft) | `OFFER_CREATED`, `OFFER_UPDATED`, `OFFER_DELETED` in `AuditLog` | `offers.e2e-spec.ts` (audit rows asserted) |
| Seed data | — | — | — | `seedOffers()` — 8 fictional NovaAir offers (6 ACTIVE rolling windows, 1 DRAFT, 1 EXPIRED), upsert on unique title (idempotent) | `offers` table | `seed-identity.spec.ts` (seed harness) |
| Scope isolation (no pricing integration) | — | — | No offer→fare/booking/payment coupling anywhere | — | `Offer` has no relation to fares/bookings by design | Backend grep + e2e |

## Phase 6A — Admin Dashboard Real Data

| Requirement | Use Case | UI / Screen | API Endpoint / Module | Service / Guard | Prisma / PostgreSQL | Test |
|-------------|----------|-------------|-----------------------|-----------------|---------------------|------|
| SRS 5.1 Overview dashboard (KPIs) | UC-09 | DashboardPage `/admin/dashboard` (real API) | `GET /api/admin/dashboard` (`dashboard:read`) | `DashboardController`, `DashboardService` | Aggregates over `Flight`, `Booking`, `BookingPassenger`, `BookingSeat`, `Refund`, `Baggage`; occupancy = active-booking seats ÷ upcoming-flight seats | `dashboard.service.spec.ts`, `dashboard.e2e-spec.ts` |
| Trends (7d/30d/90d) | UC-09 | Range selector drives the API query | `GET /api/admin/dashboard?range=7d|30d|90d` (validated, 400 otherwise) | `DashboardService.bucketPerDay` (UTC day buckets, zero-filled) | `Booking.bookedAt` | e2e range suite (7/30/90 + invalid) |
| Today's operations | UC-09 | Ops table + status chips | same endpoint | Reuses `FlightsService.findAll` (operatingDate = today), slim view without fares | `Flight.operatingDate` | e2e ops case |
| Recent bookings | UC-09 | Recent list (reference, amount, status — no contact PII) | same endpoint | `DashboardService` (newest 5) | `Booking.bookedAt` | e2e recent case (PII exclusion asserted) |
| Deferred metrics honesty | — | Revenue card/trend placeholders | — | `revenue`/`revenueTrend` return `null` (payments deferred; demo seed payment never surfaced); refunds/baggage are real counts over empty tables | — | e2e null assertions |
| BR-08/09 Backend-enforced RBAC | — | `permissionGuard('dashboard:read')` mirrors backend | Endpoint guarded by `PermissionsGuard` | `dashboard:read` added to seed catalog + all five staff roles; Super Admin bypass | `Permission` seed | e2e authz suite (401/403/200/Super Admin) |
| UX states | — | Skeleton, retryable error, empty states (flights/bookings/revenue) | — | — | — | `dashboard.component.spec.ts` (11 tests) |

## Phase 6B — Customer Booking Funnel Real API Integration

| Requirement | Use Case | UI / Screen | API Endpoint / Module | Service / Guard | Prisma / PostgreSQL | Test |
|-------------|----------|-------------|-----------------------|-----------------|---------------------|------|
| FR-C04/05/06 Search & results | UC-03 | SearchPage `/search`, ResultsPage `/results` (real API) | `GET /api/airports`, `GET /api/flights?origin&destination&date&from&to` (public) | `FlightService` (HTTP rewrite), `flight-api.model.ts` mapper (originAirport→origin, fareRules→rules) | `Airport`, `Flight.operatingDate` semantics | `flight.service.spec.ts`, `search.component.spec.ts`, `search-card.component.spec.ts`, `results.component.spec.ts` |
| FR-C07 Flight details | UC-03 | FlightDetailsPage `/flights/:id` (real API) | `GET /api/flights/:id` (public) | `FlightService.getFlight` | `Flight` + `Fare` | `flight-details.component.spec.ts` (null rules honest rendering) |
| FR-C08 Passenger data + contact | UC-03 | PassengersPage `/booking/passengers` | `POST /api/bookings` | `BookingDraftService.setContact`; contactEmail prefilled from `AuthService.user()` | `Booking.contactEmail/contactPhone` | `passengers.component.spec.ts` (14 tests) |
| FR-C09 / BR-13 Seat selection | UC-03 | SeatsPage `/booking/seats` (real seat map) | `GET /api/aircraft/:id/seats` + **`GET /api/flights/:id/seat-availability` (new)** | `SeatService` (HTTP rewrite); `FlightsService.getSeatAvailability` (occupied = non-cancelled `BookingSeat`, held = unexpired ACTIVE `SeatHold`) | `Seat`, `SeatHold` `[flightId, seatId]` partial unique index | `flights.service.spec.ts`, `seat-availability.e2e-spec.ts`, `seat.service.spec.ts`, `seats.component.spec.ts` |
| Seat concurrency (409 → reselect) | — | Review 409 → release + seats refetch | `POST /api/bookings` | Existing DB constraint + P2002→409 reused; no frontend locking | Partial unique index | `review.component.spec.ts` (409 path), Phase 4 concurrency e2e unchanged |
| Booking creation (server-authoritative) | UC-03 | ReviewPage `/booking/review` (authGuard) | `POST /api/bookings` (JWT) | `CustomerBookingService.create`; payload = `CreateBookingDto` fields only (no userId/status/totals/payments) | Server: fare totals, `NV` reference, PENDING, holds | `customer-booking.service.spec.ts`, `review.component.spec.ts` (payload exactness) |
| FR-C14 Confirmation | UC-03 | ConfirmationPage `/booking/confirmation?id=` (authGuard) | `GET /api/bookings/:id` (owner) | `CustomerBookingService.getById`; honest PENDING/payment-later UX | — | `confirmation.component.spec.ts` |
| FR-C15/16 My bookings / manage | UC-05 | MyBookingsPage `/bookings`, ManageBookingPage `/bookings/:id`, ManageLookupPage `/manage` | `GET /api/bookings`, `GET /api/bookings/:id`, `POST /api/bookings/:id/cancel` (owner-scoped) | `CustomerBookingService`; cancel offered only for PENDING (409 otherwise); lookup → login + owner list, no public lookup API | `Booking.status` | `my-bookings.component.spec.ts`, `manage-booking.component.spec.ts`, `manage-lookup.component.spec.ts` |
| Scope honesty (no payment/extras) | — | ExtrasPage demo notice (controls disabled, never sent); Review without mockpay | — | `PaymentService`/`ExtrasService` disconnected from the funnel (still mock for other pages) | — | `extras.component.spec.ts`, `review.component.spec.ts` |

## Phase 6C — Admin Catalog Real API Integration

| Requirement | Use Case | UI / Screen | API Endpoint / Module | Service / Guard | Prisma / PostgreSQL | Test |
|-------------|----------|-------------|-----------------------|-----------------|---------------------|------|
| SRS 5.2–5.5 Airports admin | UC-09 | AirportsPage `/admin/airports` (`airports:manage`) | `GET/POST /api/airports`, `PATCH /api/airports/:id` (lifecycle status, no DELETE) | `CatalogService` (HTTP), `catalog-api.model.ts` mappers; route counts/associated routes derived client-side from one `GET /api/routes` fetch | `Airport` unique `iataCode` → 409 | `catalog.service.spec.ts`, `airports.component.spec.ts` |
| SRS 5.2–5.5 Routes admin | UC-09 | RoutesPage `/admin/routes` (`routes:manage`) | `GET/POST /api/routes`, `PATCH /api/routes/:id`; airports from `GET /api/airports`; flight count from one `GET /api/flights` fetch, honestly labeled "Upcoming flights" (rolling window, no all-time count) | `CatalogService`; `originAirport→origin` mapping; UUID-based creation | `Route` `@@unique([originAirportId, destinationAirportId])` → 409 | `routes.component.spec.ts` |
| SRS 5.2–5.5 Aircraft admin | UC-09 | AircraftPage `/admin/aircraft` (`aircraft:manage`) | `GET/POST /api/aircraft`, `GET /api/aircraft/:id(/seats)`, `PATCH /api/aircraft/:id` | `CatalogService`; `seatCount` for list; seats loaded lazily per drawer; **client `buildSeats()` deleted — server-generated seat map is authoritative** | `Aircraft` unique `registration` → 409; aircraft+seats in one transaction | `aircraft.component.spec.ts` |
| Status presentation | — | `AIRCRAFT_STATUS_MAP` added to `core/status-maps.ts` | — | — | — | covered by component specs |
| Error handling | — | `.list-error` retry + `toErrorMessage` (400/401/403/404/409/5xx) on all three pages | — | — | — | component specs |

## Phase 6D — Admin Schedule Rules + Flight Operations Real API Integration

| Requirement | Use Case | UI / Screen | API Endpoint / Module | Service / Guard | Prisma / PostgreSQL | Test |
|-------------|----------|-------------|-----------------------|-----------------|---------------------|------|
| Schedule Rules admin | UC-09 | ScheduleRulesPage `/admin/schedule-rules` (`permissionGuard('flights:read')`; manage actions `*naHasPermission="'flights:manage'"`) | `GET /api/schedule-rules(/:id)`, `POST /api/schedule-rules`, `PATCH /api/schedule-rules/:id` (edit + ACTIVE/INACTIVE, no DELETE) | `ScheduleRulesService` (HTTP), `schedule-rule-api.model.ts` (Weekday union, nested route/aircraft mapping); routes/aircraft from `CatalogService` | `ScheduleRule` unique `flightNumber` → 409; `Weekday[]`; route/aircraft FKs Restrict | `schedule-rules.service.spec.ts`, `schedule-rules.component.spec.ts` |
| Admin flight operations | UC-09 | FlightsPage `/admin/flights` | `GET /api/flights` (list) + lazy `GET /api/flights/:id` on drawer open (real segments, cached, stale-guard) | `FlightService.adminFlights/getFlight`; fake create/cancel/reschedule/assign **removed** (no `PATCH /flights/:id` exists) | `Flight`, `FlightSegment`, `Fare` | `flights.component.spec.ts` (13 tests) |
| Flight generation | UC-09 | "Generate flights" drawer (manage-only) | `POST /api/flights/generate` `{from,to}` (≤62 days, 400 otherwise) | `ScheduleRulesService.generateFlights`; real `GenerationSummary` incl. skippedRules; list refreshed | Generation idempotency keys `(scheduleRuleId, operatingDate)` etc. | `flights.component.spec.ts` (validation, exact body, summary, no double submit) |
| **Known limitation** | — | Per-flight status editing intentionally NOT implemented: the backend exposes no flight-status mutation endpoint, and regeneration can overwrite generated `status`/`scheduleStatus` (`flight-generator.ts:139-153`). Requires a separate backend change — outside Phase 6D. | — | — | — | — |

## Phase 6E — Admin Bookings Real API Integration

| Requirement | Use Case | UI / Screen | API Endpoint / Module | Service / Guard | Prisma / PostgreSQL | Test |
|-------------|----------|-------------|-----------------------|-----------------|---------------------|------|
| SRS 5.6 Booking management (reads) | UC-09 | AdminBookingsPage `/admin/bookings` (`permissionGuard('bookings:read')`) | `GET /api/admin/bookings` (filters: reference/status/email — server-side only), `GET /api/admin/bookings/:id` (lazy drawer, cached) | `CustomerBookingService.listAdmin/getAdmin`; flat `CustomerBooking` view (shared `toView`) | `Booking`, `BookingPassenger`, `Passenger`, `SeatHold` relations | `customer-booking.service.spec.ts`, `admin-bookings.component.spec.ts` (18 tests) |
| Booking audit trail | UC-12 | Drawer Audit tab (`audit:read`-gated) | `GET /api/audit?targetType=Booking&targetId=<id>` | `AuditService.listLogs` (real) | `AuditLog` | component spec (call shape, rendering, 403 path) |
| Honest deferred states | — | Payments/Refunds + Notifications tabs show "future phase" empty states; manage-tier non-clickable hint for admin cancel/BR-14 | — | seats presented per-booking (API has no seat↔passenger link) | — | component spec (no fake cancel/BR-14/refund/payments) |
| **Deferred (backend phase required)** | — | Admin cancellation, BR-14 payment exception, payments, refunds, notifications — no backend exists; NOT faked | — | — | — | — |
| **Known limitations** | — | Admin list unpaginated (fine at current scale); filters limited to reference/status/email; seat-to-passenger association unavailable in the current API | — | — | — | — |

## Known Gaps (to be addressed in later phases)

- The admin users page and the check-in/boarding-pass/baggage/loyalty/notifications pages still run on `core/mock/` services; their backends (where they exist) are wired in later phases.
- Payments and refunds are not implemented (future phase). One mock `Payment` row exists in seed demo data only; real bookings remain PENDING until then.
- Automatic `Offer` ACTIVE→EXPIRED status transition is not implemented; public visibility is date-filtered server-side, so expiry is enforced regardless.
- Localization and multi-currency support (NFR-13) planned for a future phase.
