# Prompt for Kimi K3 — Implement the Lufthansa-Inspired Airline Booking System (SRS v2.1)

Copy everything below the line into Kimi K3 as a single prompt.

---

## Role

You are a senior full-stack engineer. Implement a **Lufthansa-inspired airline management & booking platform** according to the attached **SRS v2.1** ("Lufthansa_SRS_v2.1_Reviewed_Technical_Architecture_Added.docx"). The SRS is the single source of truth — read it fully before writing any code, and treat every requirement as binding. This is an **educational** project: do NOT use real Lufthansa branding assets, do NOT claim real airline inventory, and mock all external integrations behind replaceable adapters.

## Technology Baseline (mandatory — Section 19.1)

- **Frontend:** Angular (standalone components, routed feature modules, reactive forms, typed API clients, client-side validation + accessibility)
- **Backend:** NestJS (REST JSON API over HTTPS, DTO validation with class-validator, guards, interceptors, scheduled jobs)
- **Database:** PostgreSQL (transactional system of record)
- **ORM:** Prisma (only data-access layer; version-controlled migrations; explicit `@@map`/`@map` for stable SQL naming)
- **Monorepo layout:** `/apps/web` (Angular), `/apps/api` (NestJS), `/prisma` (schema + migrations), `/packages/shared` (shared DTO types if useful)
- Optional team guidance: mattpocock/skills (engineering guidance only, not a runtime dependency)

## Scope — Two Applications, One API

### 1. Customer Web App (FR-C01 … FR-C24)
Implement every customer functional requirement, including:
- Registration, secure login/logout, **password reset / account recovery**, optional MFA (FR-C01, FR-C02, FR-C24)
- Profile management (FR-C03)
- Flight search by **trip type (one-way / round-trip / multi-city)**, origin, destination, dates, passengers, cabin class (FR-C04)
- Results with schedule **in local airport time**, duration, stops, fares, availability; filtering/sorting by price, time, duration, stops, class (FR-C05, FR-C06)
- Flight details (FR-C07)
- Passenger data collection and validation (FR-C08)
- **Seat selection with a temporary seat hold during checkout** (FR-C09 + BR-13)
- Baggage allowance + additional baggage, extras (FR-C10, FR-C11)
- Fare calculation: fare + taxes + fees + baggage + extras + discounts (FR-C12)
- Payment via **PCI DSS–compliant provider with tokenization — never store raw card data** (FR-C13, NFR-01)
- Unique booking reference on confirmation (FR-C14)
- My Bookings, manage booking (modify/rebook/cancel per fare rules) (FR-C15, FR-C16)
- Online check-in + digital boarding pass (FR-C17, FR-C18)
- Flight status search, baggage tracking display, notifications, loyalty balance/history (FR-C19–FR-C22)
- Fully responsive desktop/tablet/mobile layouts (FR-C23)

### 2. Admin Dashboard (SRS Section 5.1–5.16)
Implement all sixteen admin modules with the navigation from Section 14:
Overview/analytics (totals, trends, today's flights, filters, role-aware), Flights, Airports, Aircraft (incl. seat configuration/cabin layout), Routes, Bookings (incl. **audited exception workflow** for confirming without payment), Users/Passengers, Staff, Roles & Permissions, Payments/Refunds, Baggage (incl. lost/delayed/delivered events), Check-in & Boarding, Loyalty/Miles, Notifications (templates + targeted sends + delivery status), Reports (booking/revenue/passenger/occupancy/cancellation, filterable + exportable), Audit Log (searchable, **immutable for ordinary admins**), System Settings (restricted to Super Admin/authorized roles).

## Business Rules — enforce in the backend, not the UI (Section 8)

- **BR-01** Confirmed booking ⇒ ≥1 valid passenger + ≥1 valid flight segment
- **BR-02** One seat ⇒ one passenger per flight segment (enforce with DB uniqueness)
- **BR-03** Flight capacity never exceeded
- **BR-04 / BR-05** No confirmed booking without successful payment; payment failure never creates a confirmed booking
- **BR-06 / BR-15** Cancellation/refund/rebooking eligibility and amounts computed from configured fare rules, cancellation fees, and original payment amount
- **BR-07** Check-in only when booking + flight satisfy configured eligibility rules
- **BR-08 / BR-09** Backend-enforced RBAC on every protected operation; Super Admin has full permissions
- **BR-10 / BR-11** Audit log for sensitive actions with actor, action, target, timestamp
- **BR-12** Customers can only access their own booking/payment data
- **BR-13** Seat hold during checkout with **automatic expiry** if payment isn't completed within a configured window (Scheduler actor)
- **BR-14** Admin confirmation without successful payment only via an explicitly authorized, always-audited exception workflow

## Data Model (Section 10) — Prisma schema + PostgreSQL

Model all 30 entities: User, Role, Permission, UserRole, RolePermission, Passenger, Airport, Route, Aircraft, Seat, **SeatHold**, Flight, FlightSegment, Fare, Booking, BookingPassenger, BookingSeat, Payment, Baggage, BaggageEvent, CheckIn, BoardingPass, ExtraService, BookingExtra, Notification, NotificationTemplate, LoyaltyAccount, LoyaltyTransaction, Refund, AuditLog, SystemSetting.

Design rules (Section 19.5):
- UUID primary keys everywhere (unless a documented external ID is required)
- Unique constraints on business identifiers: booking reference, IATA codes, loyalty member number, baggage tag number, payment provider reference
- Deliberate FK restrict/cascade behavior; **retain** booking/payment records for audit and financial traceability — never hard-delete casually
- Seat allocation protected by active seat holds + transaction isolation + DB uniqueness
- Indexes for lookup paths (IATA codes, booking refs, seat-hold expiry queries)
- Sensitive values minimized, encrypted/tokenized, excluded from logs, with retention/deletion per GDPR-oriented NFR-10
- Migrations version-controlled; no manual production schema changes

## Architecture (Sections 11 & 19.2)

```
Customer Web App / Admin Dashboard (Angular)
        → NestJS REST API (JSON over HTTPS)
        → AuthN/AuthZ guards (backend is the ONLY security boundary)
        → Domain services → Prisma → PostgreSQL
Backend → Payment Provider adapter (mockable, tokenized)
Backend → Notification Provider adapter (email/SMS, mockable)
Scheduler worker → flight-status sync, seat-hold expiry, notification retries
```

- NestJS modules per the mapping schema (Section 19.4): `FlightsModule`, `BookingsModule`, `PaymentsModule`, `OperationsModule` (check-in + baggage), `UsersModule` (accounts, staff, RBAC, loyalty), `NotificationsModule`, `AuditModule`, plus admin-facing controllers
- Controllers validate DTOs and delegate to domain services; services never leak DB details to the frontend
- All multi-record booking / payment / seat-hold / check-in / cancellation updates use **explicit Prisma transactions**
- External integrations isolated behind interfaces so mocks can be swapped in non-production

## Non-Functional Requirements (Section 9)

- **NFR-01 Security:** bcrypt/argon2 password hashing, JWT/session hardening, input validation, no raw card storage, **rate limiting / anti-abuse on public search & booking endpoints**
- **NFR-02/03/05:** Acceptable performance, scalable modular design, graceful degradation when external providers fail
- **NFR-04/11:** Consistent booking/payment state; no duplicate confirmed bookings; referential integrity across flights, seats, passengers, bookings, payments, baggage
- **NFR-06/07:** Clear navigation, validation feedback, responsive UI
- **NFR-09:** Full auditability of security-sensitive and administrative actions
- **NFR-10:** GDPR-aligned privacy — access control, defined retention/deletion periods
- **NFR-12:** Documented backup/recovery strategy
- **NFR-13:** Localization — multi-language and multi-currency support on the customer platform

## Delivery Plan — work in phases, show working software at each gate

1. **Phase 0 — Foundation:** monorepo scaffold, Prisma schema for all 30 entities, initial migration, seed data (airports, aircraft, routes, sample flights, roles incl. Super Admin, demo users), docker-compose for PostgreSQL
2. **Phase 1 — Identity & RBAC:** registration, login, password reset, MFA hooks, roles/permissions, guards, audit-log service
3. **Phase 2 — Flight catalog:** airports/routes/aircraft/flights CRUD (admin) + public search with trip types, filters, sorting, rate limiting
4. **Phase 3 — Booking core:** passenger data, seat selection with seat holds + expiry scheduler, fare calculation, payment adapter (mock provider, idempotency, tokenization), confirmation with unique booking reference
5. **Phase 4 — Post-booking:** manage booking, cancellation/refund engine (BR-06/BR-15), check-in + boarding pass, baggage records/events, notifications
6. **Phase 5 — Admin dashboard:** all Section 5 modules incl. reports, exports, audit-log viewer, system settings
7. **Phase 6 — Hardening:** loyalty, localization, backup docs, E2E tests, performance pass

## Acceptance Criteria (Section 19.6 — mandatory)

A feature is DONE only when its requirement ID traces through: use case → Angular screen → NestJS endpoint + service → Prisma model/transaction → PostgreSQL constraint/index → automated test. In addition:

- Repository contains Prisma schema + migration history for every DB change
- DTOs, authorization guards, and service methods covered by unit/integration tests for the corresponding business rules
- **Critical booking, seat-hold, payment, cancellation, and check-in flows have E2E tests against a real PostgreSQL test database**
- Angular and NestJS module names stay aligned with the Section 19.4 mapping schema (or update the traceability doc in the same change)
- Maintain a `TRACEABILITY.md` mapping each FR/NFR/BR to its implementation and tests

## Working Agreement

- Read the full SRS first; if any requirement seems contradictory, follow the v2.1 change log resolutions (Section 18) and state your interpretation explicitly
- Never treat the Angular UI as a security boundary — all authorization enforced in NestJS
- Mock payment/notification/flight-status providers, but keep the adapter interfaces production-shaped
- After each phase, output: what was implemented, which SRS requirement IDs it covers, test results, and known gaps
- Start with Phase 0 and Phase 1 now: produce the repo scaffold, complete Prisma schema with migrations, seed script, and the auth/RBAC foundation with tests.

Begin.
