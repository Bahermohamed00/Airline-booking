# Traceability Matrix — Phase 0 & Phase 1

This document maps SRS v2.1 requirements to their implementation artifacts for the foundation and identity/RBAC phases.

## Legend

- `FR-Cxx` — Customer functional requirement
- `FR-Axx` — Admin functional requirement (numbered from SRS Section 5)
- `BR-xx` — Business rule
- `NFR-xx` — Non-functional requirement
- `UC-xx` — Use case

## Phase 0 — Foundation

| Requirement | Use Case | UI / Screen | API / Module | Service / Guard | Prisma / PostgreSQL | Test |
|-------------|----------|-------------|--------------|-----------------|---------------------|------|
| NFR-08 Maintainability | — | Monorepo layout (`/apps/web`, `/apps/api`, `/prisma`, `/packages/shared`) | `AppModule`, feature modules | Separation of concerns | Schema in `/prisma/schema.prisma` | Repository structure review |
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

## Known Gaps (to be addressed in later phases)

- Angular screens for customer registration, login, password reset, MFA setup are scaffolded but not yet implemented.
- Admin dashboard UI modules (Section 5.1–5.16) are not yet built.
- Flight search, booking, payment, seat hold, check-in, and baggage flows belong to Phases 2–5.
- E2E tests for critical booking/payment/check-in flows require Phase 3+ implementation.
- Localization and multi-currency support (NFR-13) planned for Phase 6.
