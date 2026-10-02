# NovaAir — Business Documentation

**Version:** 1.0 · **Basis:** SRS v2.1 (Lufthansa-inspired) + implemented system state
**Companion docs:** `PROJECT_OVERVIEW.md` (technical), `TRACEABILITY.md` (requirement → code), `CONTEXT.md` (domain glossary), `SETUP.md` (local setup)

---

## 1. Purpose & Scope

This document describes the **NovaAir airline booking & management platform** as a business system: who uses it, what it does, the rules it enforces, and the complete list of features that exist today. It covers both the customer-facing portal and the staff back-office, plus the platform capabilities underneath (security, audit, scheduling).

Each feature carries a status:

| Status       | Meaning                                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| **Live**     | Fully implemented end-to-end (UI + API + database).                                                       |
| **Partial**  | Exists with limitations — e.g. UI present but backed by demo/mock data, or API live but UI not yet wired. |
| **Deferred** | Specified in the SRS but intentionally not built yet; nothing is faked.                                   |

---

## 2. Executive Summary

NovaAir is a full-stack airline platform covering the complete travel lifecycle:

- **Sell** — guests and customers search flights, view fares and offers, select seats, and book.
- **Fly** — customers manage bookings, pay, cancel, check in, and track flights and baggage.
- **Operate** — staff manage the flight catalog (airports, aircraft, routes), generate flight schedules from recurring rules, administer bookings, process payments and refunds, and monitor operations on a live dashboard.
- **Govern** — role-based access control with 7 roles, full audit logging of sensitive actions, session management, and rate-limited public endpoints.

**Technology:** Angular 22 customer/staff web app · NestJS 11 REST API (`/api` prefix) · PostgreSQL via Prisma 6 · JWT sessions with rotating refresh tokens · Argon2id password hashing.

**Seed dataset ("NovaAir"):** 10 airports, 4 aircraft with generated seat maps, 8 routes, 11 schedule rules producing a rolling 14-day flight window, demo admin and customer accounts, sample bookings, offers, loyalty data, and system settings.

---

## 3. Business Actors & Roles

### 3.1 Actors

| Actor                    | Description                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **Guest**                | Unauthenticated visitor. Can search flights, view flight details/status, and browse public offers only.                         |
| **Customer**             | Registered user with the Customer role. Books and manages only their own data (profile, bookings, payments, check-in, loyalty). |
| **Passenger**            | A person traveling on a booking. A Passenger may exist without a user account (booked by someone else).                         |
| **Staff**                | A user holding any back-office role (see 3.2).                                                                                  |
| **Payment Provider**     | External service that processes card transactions (tokenized; raw card data never touches the system).                          |
| **Notification Service** | Email adapter — console mock in dev or SMTP via configuration.                                                                  |
| **System/Scheduler**     | Background jobs: seat-hold expiry (every minute), flight generation, notification triggers.                                     |

### 3.2 Staff roles & access scope

Authorization is **backend-enforced RBAC**: every protected operation checks permissions resolved from the database per request. UI visibility is never treated as authorization.

| Role                | Access scope (seeded permissions)                                                                                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Super Admin**     | Full system access via a super-admin flag that bypasses permission checks. Sole default holder of `staff:manage`, `roles:manage`, `settings:manage`, `offers:*`, `loyalty:manage`, `notifications:manage`. |
| **Administrator**   | User management (read/create/update/deactivate), booking read+manage, reports, audit log, dashboard.                                                                                                       |
| **Flight Manager**  | Flights (read/manage), airports, aircraft, routes management, dashboard.                                                                                                                                   |
| **Booking Manager** | Bookings (read/manage), user read, dashboard.                                                                                                                                                              |
| **Finance Staff**   | Payments read, refunds, reports, dashboard.                                                                                                                                                                |
| **Support Staff**   | User read, booking read, baggage manage, check-in manage, dashboard.                                                                                                                                       |
| **Customer**        | Own profile, bookings, payments, check-in, baggage, loyalty only (BR-12 data isolation).                                                                                                                   |

### 3.3 Permission catalog

Permissions are `resource:action` pairs seeded in the database:

`users:read/create/update/delete` · `staff:manage` · `roles:manage` · `flights:read/manage` · `airports:manage` · `aircraft:manage` · `routes:manage` · `bookings:read/manage` · `payments:read/refund` · `baggage:manage` · `checkin:manage` · `loyalty:manage` · `notifications:manage` · `reports:read` · `audit:read` · `dashboard:read` · `settings:manage` · `offers:read/manage`

---

## 4. Domain Model (Business Entities)

Canonical vocabulary follows `CONTEXT.md`. The database holds **37 models** in these domains:

### 4.1 Identity & Access

- **User** — login account (email, Argon2id password hash, MFA secret, status). A User is not necessarily a Passenger.
- **Role / Permission / UserRole / RolePermission** — RBAC bundles and assignments.
- **Session** — one authenticated device context, created at login, revocable; owns a chain of refresh tokens.
- **RefreshToken** — opaque, single-use, rotating, stored only as a SHA-256 hash; reuse triggers detection.
- **EmailVerificationToken / PasswordResetToken** — opaque single-use emailed credentials, hash-stored; reset tokens expire after 1 hour and requesting a new one invalidates previous ones.

### 4.2 Fleet & Network Catalog

- **Airport** — IATA code (unique), name, city, country, timezone, operational status.
- **Aircraft** — model, registration (unique), capacity, status; owns a server-generated seat map.
- **Seat** — one per aircraft position, with cabin class and attributes.
- **Route** — origin/destination airport pair (unique combination), distance/duration metadata.

### 4.3 Schedule & Fares

- **ScheduleRule** — recurring weekly pattern (flight number, route, aircraft, weekdays, times); the source from which flights are generated.
- **Flight** — one operating date-instance of a schedule rule, with status and schedule status.
- **FlightSegment** — leg of a flight (supports multi-stop).
- **Fare** — per flight + cabin class: base price, tax, fees, and fare-rules snapshot (unique per flight/cabin).

### 4.4 Booking

- **Booking** — purchase of seats on a flight, owned by exactly one user; public **Booking Reference** (`NV` + 6 characters, collision-retried). Statuses: PENDING → CONFIRMED / CANCELLED. Server-computed totals with a fare-rules snapshot.
- **Passenger / BookingPassenger** — traveler records linked to a booking.
- **SeatHold** — time-boxed (15-minute) lock on a seat during checkout; statuses ACTIVE / EXPIRED / CONVERTED / RELEASED. A partial unique index guarantees at most one ACTIVE hold per flight+seat (BR-13).
- **BookingSeat** — the final seat assignment after payment (unique per flight segment + seat — BR-02).

### 4.5 Payments

- **Payment** — one per paid booking; statuses SUCCESS / REFUNDED / PARTIALLY_REFUNDED etc.; provider reference only, never raw card data.
- **Refund** — PENDING → PROCESSED / REJECTED lifecycle, recorded and row-locked **before** the provider call so money never moves without a committed record.

### 4.6 Loyalty, Offers & Engagement

- **LoyaltyAccount / LoyaltyTransaction** — miles balance and earn/spend history.
- **Offer** — marketing offer with lifecycle DRAFT / ACTIVE / INACTIVE / EXPIRED and a validity window; public visibility is filtered server-side. Deliberately **not** coupled to pricing.
- **NotificationTemplate / Notification** — templated customer notifications with delivery status.

### 4.7 Operations & Governance

- **Baggage / BaggageEvent** — baggage records with operational status events (lost/delayed/delivered).
- **CheckIn / BoardingPass** — check-in records and issued boarding passes.
- **ExtraService / BookingExtra** — ancillary services attachable to bookings.
- **SystemSetting** — configurable system/reference data.
- **AuditLog** — immutable record of sensitive actions: actor, action, target, timestamp, metadata (BR-10/BR-11).

---

## 5. Business Rules (BR-01 – BR-15)

| Rule  | Statement                                                                           | Enforcement in system                                                                                                                       | Status     |
| ----- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| BR-01 | A confirmed booking references ≥1 valid passenger and ≥1 valid flight segment.      | Passengers created in the same transaction as the booking; confirmation only via successful payment or audited exception.                   | Live       |
| BR-02 | A seat cannot be assigned to more than one passenger on the same flight segment.    | `BookingSeat` unique `(flightSegment, seat)` + partial unique index on active holds; race → 409.                                            | Live       |
| BR-03 | A flight cannot exceed its configured passenger capacity.                           | Seat map derives from aircraft capacity; availability computed from booked + held seats.                                                    | Live       |
| BR-04 | A booking cannot become CONFIRMED without successful payment.                       | Payment success flips PENDING → CONFIRMED atomically; only BR-14 exception bypasses.                                                        | Live       |
| BR-05 | Payment failure shall not create a confirmed booking.                               | Failed provider charge leaves booking PENDING; no Payment row on failure.                                                                   | Live       |
| BR-06 | Cancellation/refund/rebooking eligibility follows configured fare rules.            | Fare-rules snapshot stored on the booking; refund targets computed from fare policy.                                                        | Live       |
| BR-07 | Check-in only when booking and flight satisfy eligibility rules.                    | Check-in eligibility logic in customer UI; backend check-in module deferred.                                                                | Partial    |
| BR-08 | Only authorized staff may perform administrative operations.                        | JWT guard + permission guard on every admin endpoint; DB-resolved per request.                                                              | Live       |
| BR-09 | Super Admin has full administrative permissions.                                    | `Role.isSuperAdmin` flag bypass in the permission guard.                                                                                    | Live       |
| BR-10 | Sensitive administrative actions create audit-log records.                          | `AuditService.log` on bookings, offers, payments, auth events; emitted post-commit, failure-isolated.                                       | Live       |
| BR-11 | An audit record identifies actor, action, target, timestamp.                        | `AuditLog` schema + query API (`/api/audit`).                                                                                               | Live       |
| BR-12 | Customers cannot access other customers' private data.                              | Owner-scoped queries; cross-user access returns 404.                                                                                        | Live       |
| BR-13 | Temporary seat hold during checkout; auto-expiry if unpaid.                         | 15-minute ACTIVE hold, one-active-per-seat DB index, cron expiry every minute + in-transaction self-heal.                                   | Live       |
| BR-14 | Admin confirmation without payment only via audited exception workflow.             | `POST /api/admin/bookings/:id/confirm-exception` — requires written justification (≥10 chars), always audited, never creates a Payment row. | Live (API) |
| BR-15 | Cancellation/refund amounts follow fare rules, cancellation fees, original payment. | Admin cancellation auto-computes the fare-policy refund target and marks the payment REFUNDED once reached.                                 | Live (API) |

---

## 6. Complete Features List

### 6.1 Customer-facing features

| #   | Feature (SRS ref)                        | What it does                                                                                                                      | Where                                                                    | Status                                              |
| --- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------- |
| C1  | Registration (FR-C01)                    | Guest creates a customer account; email verification token issued.                                                                | `/register` · `POST /api/auth/register`                                  | Live                                                |
| C2  | Login / logout (FR-C02)                  | Secure login with JWT access token (15 min) + rotating refresh token; logout of one or all sessions.                              | `/login` · `POST /api/auth/login                                         | logout                                              | logout-all` | Live |
| C3  | Session management (FR-C02)              | Customer views active device sessions and revokes any of them.                                                                    | `/profile/security` · `GET/DELETE /api/auth/sessions`                    | Live                                                |
| C4  | Password reset / recovery (FR-C24)       | Email-based reset with 1-hour single-use token; new request invalidates previous tokens.                                          | `/forgot-password`, `/reset-password` · `POST /api/auth/password-reset*` | Live                                                |
| C5  | Email verification                       | Verification link flow after registration.                                                                                        | `/verify-email` · API token endpoints                                    | Live                                                |
| C6  | Multi-factor authentication (FR-C24)     | Optional TOTP MFA: setup, verify, disable.                                                                                        | API `POST /api/auth/mfa/*`                                               | Live (API); basic UI                                |
| C7  | Profile management (FR-C03)              | View/update own profile data.                                                                                                     | `/profile` · `GET/PATCH /api/auth/me`                                    | Live                                                |
| C8  | Change password                          | Authenticated password change with rehash.                                                                                        | `/profile/security` · `POST /api/auth/change-password`                   | Live                                                |
| C9  | Flight search (FR-C04)                   | Search by origin, destination, date(s), passengers, cabin class.                                                                  | `/search` · `GET /api/flights`, `GET /api/airports`                      | Live                                                |
| C10 | Results, filtering & sorting (FR-C05/06) | Matching flights with schedule, duration, fares, availability; filter/sort by price, time, duration, stops, class.                | `/results`                                                               | Live                                                |
| C11 | Flight details (FR-C07)                  | Full detail for a selected flight incl. segments and fare rules (honest empty states when no rules).                              | `/flights/:id` · `GET /api/flights/:id`                                  | Live                                                |
| C12 | Passenger data (FR-C08)                  | Validated passenger forms + contact details (prefilled from account).                                                             | `/booking/passengers`                                                    | Live                                                |
| C13 | Seat selection with hold (FR-C09, BR-13) | Real seat map per aircraft; occupied/held seats from live availability; 15-min hold placed at booking.                            | `/booking/seats` · `GET /api/flights/:id/seat-availability`              | Live                                                |
| C14 | Baggage & extras selection (FR-C10/11)   | Extras page exists; controls disabled with an honest demo notice — never sent to the server.                                      | `/booking/extras`                                                        | Deferred                                            |
| C15 | Fare calculation (FR-C12)                | Server-authoritative totals: (base + tax + fees) × passengers with fare-rules snapshot; client-supplied totals rejected.          | `/booking/review` · `POST /api/bookings`                                 | Live                                                |
| C16 | Payment (FR-C13)                         | Tokenized payment via provider adapter; paying a PENDING booking confirms it, converts holds to seats, records a SUCCESS payment. | `POST /api/bookings/:id/payment`                                         | Live                                                |
| C17 | Booking confirmation (FR-C14)            | Unique `NVxxxxxx` booking reference; confirmation page with honest PENDING/pay-later state.                                       | `/booking/confirmation` · `GET /api/bookings/:id`                        | Live                                                |
| C18 | My bookings (FR-C15)                     | List current and historical own bookings.                                                                                         | `/bookings` · `GET /api/bookings`                                        | Live                                                |
| C19 | Manage booking / cancellation (FR-C16)   | View own booking detail; cancel while PENDING (409 otherwise); holds released on cancel.                                          | `/bookings/:id`, `/manage` · `POST /api/bookings/:id/cancel`             | Live                                                |
| C20 | Online check-in (FR-C17)                 | Check-in UI with eligibility rules.                                                                                               | `/checkin`                                                               | Partial (demo data)                                 |
| C21 | Boarding pass (FR-C18)                   | Digital boarding pass after check-in.                                                                                             | `/checkin/:bookingId/pass`                                               | Partial (demo data)                                 |
| C22 | Flight status (FR-C19)                   | Status search by flight/route/date.                                                                                               | `/status` · `GET /api/flights`                                           | Live                                                |
| C23 | Baggage tracking (FR-C20)                | Baggage tracking view.                                                                                                            | `/baggage`                                                               | Partial (demo data)                                 |
| C24 | Notifications (FR-C21)                   | Notification list in profile.                                                                                                     | `/profile/notifications`                                                 | Partial (demo data; email adapter live server-side) |
| C25 | Loyalty / miles (FR-C22)                 | Balance and transaction history.                                                                                                  | `/loyalty`                                                               | Partial (demo data)                                 |
| C26 | Offers catalog                           | Public offers filtered server-side to ACTIVE + inside validity window; internals stripped.                                        | `/offers` · `GET /api/offers`                                            | Live                                                |
| C27 | Responsive UI (FR-C23)                   | Desktop/tablet/mobile layouts across the portal.                                                                                  | all pages                                                                | Live                                                |
| C28 | Help / support page                      | Static help and contact information.                                                                                              | `/help`                                                                  | Live                                                |

### 6.2 Admin / staff back-office features

All admin routes sit behind the staff guard plus per-page permission guards that mirror the backend.

| #   | Feature (SRS ref)                                | What it does                                                                                                                                                                                        | Where                                                                             | Status                                                                |
| --- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| A1  | Dashboard overview & analytics (5.1)             | Real KPIs (flights, bookings, passengers, users, revenue from live payments, occupancy), 7/30/90-day zero-filled trends, today's operations, recent bookings (no PII), skeleton/retry/empty states. | `/admin/dashboard` · `GET /api/admin/dashboard`                                   | Live                                                                  |
| A2  | Flight operations (5.2)                          | Flight list with lazy detail drawer (segments, fares); generate flights from schedule rules over a ≤62-day window with idempotency and skipped-rule summary.                                        | `/admin/flights` · `GET /api/flights`, `POST /api/flights/generate`               | Live — _per-flight status editing intentionally not built (Deferred)_ |
| A3  | Schedule rules (5.2)                             | CRUD for recurring weekly flight patterns (activate/deactivate, no delete); unique flight number.                                                                                                   | `/admin/schedule-rules` · `/api/schedule-rules`                                   | Live                                                                  |
| A4  | Airport management (5.3)                         | Create/update airports, lifecycle status (no hard delete); IATA uniqueness → 409.                                                                                                                   | `/admin/airports` · `/api/airports`                                               | Live                                                                  |
| A5  | Aircraft management (5.4)                        | Create/update aircraft with server-generated seat map in one transaction; lazy seat drawer; registration uniqueness → 409.                                                                          | `/admin/aircraft` · `/api/aircraft`                                               | Live                                                                  |
| A6  | Route management (5.5)                           | Create/update routes between airports; unique pair → 409; upcoming-flight counts.                                                                                                                   | `/admin/routes` · `/api/routes`                                                   | Live                                                                  |
| A7  | Booking management (5.6)                         | Search/filter all bookings (reference, status, email); detail drawer with passengers, seats, holds; per-booking audit trail tab.                                                                    | `/admin/bookings` · `GET /api/admin/bookings`                                     | Live (reads + audit)                                                  |
| A8  | Admin cancellation with auto-refund (5.6, BR-15) | Staff cancels a booking; system computes the fare-policy refund and processes it automatically.                                                                                                     | `POST /api/admin/bookings/:id/cancel`                                             | Live (API); UI Deferred                                               |
| A9  | Payment-exception confirmation (5.6, BR-14)      | Confirm an unpaid booking only with a written justification; always audited.                                                                                                                        | `POST /api/admin/bookings/:id/confirm-exception`                                  | Live (API); UI Deferred                                               |
| A10 | Payments & finance (5.9)                         | Payment list/search with filters, detail, refund action with remainder validation; refund list with statuses.                                                                                       | `/admin/payments`, `/admin/refunds` · `/api/admin/payments`, `/api/admin/refunds` | Live                                                                  |
| A11 | User management (5.7)                            | Customer account search/view page.                                                                                                                                                                  | `/admin/users`                                                                    | Partial (demo data; `users` API live)                                 |
| A12 | Staff management (5.8)                           | Create/manage staff accounts and role assignment against the live API.                                                                                                                              | `/admin/staff` · `/api/users`                                                     | Live                                                                  |
| A13 | Roles & permissions (5.8)                        | Role catalog with permission matrix.                                                                                                                                                                | `/admin/roles` · `/api/roles`                                                     | Live                                                                  |
| A14 | Baggage management (5.10)                        | Baggage records and event management.                                                                                                                                                               | `/admin/baggage`                                                                  | Partial (demo data)                                                   |
| A15 | Check-in & boarding ops (5.11)                   | Check-in status, seats, boarding-pass views.                                                                                                                                                        | `/admin/checkin`                                                                  | Partial (demo data)                                                   |
| A16 | Loyalty management (5.12)                        | Loyalty accounts and adjustments.                                                                                                                                                                   | `/admin/loyalty`                                                                  | Partial (demo data)                                                   |
| A17 | Offer management                                 | Admin CRUD for offers (create/edit/deactivate — no hard delete); duplicate title → 409; all mutations audited.                                                                                      | `/admin/offers` · `/api/admin/offers`                                             | Live                                                                  |
| A18 | Notification management (5.13)                   | Templates and operational notifications.                                                                                                                                                            | `/admin/notifications`                                                            | Partial (demo data)                                                   |
| A19 | Reports (5.14)                                   | Operational/financial report views with CSV export.                                                                                                                                                 | `/admin/reports`                                                                  | Partial (aggregates demo data)                                        |
| A20 | Audit log (5.15)                                 | Search/filter immutable audit records (actor, action, target, timestamp, metadata); per-booking audit tab in A7.                                                                                    | `/admin/audit` · `GET /api/audit`                                                 | Live                                                                  |
| A21 | System settings (5.16)                           | Settings page gated to `settings:manage`.                                                                                                                                                           | `/admin/settings`                                                                 | Partial (UI; settings API deferred)                                   |
| A22 | Admin login & access-denied handling             | Separate staff login entry; permission-denied page.                                                                                                                                                 | `/admin/login`, `/admin/denied`                                                   | Live                                                                  |

### 6.3 Platform / cross-cutting features

| #   | Feature                                | Description                                                                                                                                            | Status   |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| P1  | JWT session security                   | 15-min access tokens bound to a session; single-use rotating refresh tokens with reuse detection; hash-only storage.                                   | Live     |
| P2  | Password security                      | Argon2id hashing; legacy bcrypt hashes verified and transparently rehashed on login.                                                                   | Live     |
| P3  | Backend-enforced RBAC                  | DB-resolved `resource:action` permission check on every protected request; Super Admin bypass.                                                         | Live     |
| P4  | Audit logging                          | Sensitive actions (auth, bookings, seat holds, offers, payments) logged post-commit; logging failure never breaks the business action.                 | Live     |
| P5  | Rate limiting / anti-abuse             | Global throttler with stricter limits on public search/booking endpoints; throttling audited.                                                          | Live     |
| P6  | Email notifications                    | Notification adapter: console mock in dev or SMTP via environment config.                                                                              | Live     |
| P7  | Seat-hold scheduler                    | Cron job (every minute) expires stale holds and frees seats; in-transaction self-heal as backup.                                                       | Live     |
| P8  | Flight generation engine               | Generates flight instances from schedule rules for a rolling window; idempotent per (rule, date).                                                      | Live     |
| P9  | Concurrency protection                 | Defense-in-depth against double-booking: DB partial unique index + unique constraints + P2002→409 mapping; verified by parallel-request e2e tests.     | Live     |
| P10 | Data isolation                         | Customer queries owner-scoped; cross-account access returns 404 (BR-12).                                                                               | Live     |
| P11 | Idempotent seed                        | Demo dataset (10 airports, 4 aircraft + seat maps, 8 routes, 11 schedule rules, 14-day flights, demo bookings, offers, loyalty, settings) via upserts. | Live     |
| P12 | Localization & multi-currency (NFR-13) | Multiple languages/currencies for the international customer base.                                                                                     | Deferred |

---

## 7. Core Business Workflows

### 7.1 Book a flight (end-to-end)

1. Guest/Customer searches flights (`/search`) and picks one from `/results`.
2. Reviews flight details and fare rules (`/flights/:id`).
3. Enters passenger + contact data (`/booking/passengers`).
4. Selects seats on the real seat map (`/booking/seats`); occupied/held seats blocked.
5. Reviews the server-computed price breakdown (`/booking/review`, login required).
6. Server creates the booking **PENDING** in one transaction: passengers, 15-min seat holds, fare snapshot, `NV` reference. Double-book attempts lose the race with 409.
7. Customer pays (`POST /api/bookings/:id/payment`): on provider success the booking flips to **CONFIRMED**, holds convert to `BookingSeat` rows, a SUCCESS payment is recorded. On failure the booking stays PENDING (BR-04/05).
8. Confirmation page shows the reference and honest status (`/booking/confirmation`).

### 7.2 Cancel & refund

- **Customer:** cancels own booking while PENDING (`/bookings/:id`); holds are RELEASED, history preserved.
- **Staff (BR-15):** admin cancellation computes the refund target from the booking's fare-policy snapshot; refunds are recorded PENDING under a row lock **before** the provider call, then marked PROCESSED (or REJECTED on provider failure); the payment becomes REFUNDED once the target is reached. Money never moves without a committed database record.

### 7.3 Payment-exception confirmation (BR-14)

A Booking Manager/Administrator can confirm an unpaid booking only through `confirm-exception` with a mandatory written justification (≥10 characters). Every exception writes an audit record; no Payment row is fabricated.

### 7.4 Schedule → flights

Flight Manager defines weekly **schedule rules** → "Generate flights" materializes flight instances with segments and fares for a chosen window (≤62 days), idempotently (re-runs skip existing (rule, date) pairs and report skipped rules).

### 7.5 Seat-hold expiry

Holds expire after 15 minutes without payment: a per-minute scheduler marks them EXPIRED and releases the seat; any booking attempt also self-heals stale holds in-transaction.

---

## 8. Payments & Refunds Policy

- **PCI posture:** raw card data is never stored or transmitted through the platform; charging happens via a PCI DSS–compliant provider adapter using tokens (NFR-01).
- **Booking ↔ payment invariant:** CONFIRMED requires a successful payment (BR-04) or an audited BR-14 exception.
- **Refund discipline:** refunds are validated against the remaining refundable balance (over-refund → 409), recorded before provider execution, and never silently lost on provider failure (marked REJECTED).
- **Transparency:** customers see honest statuses (PENDING / pay later); demo payment data is never surfaced as real revenue.

---

## 9. Non-Functional Characteristics (NFR-01 – NFR-13)

| NFR    | Category          | Implementation                                                                                                                                          | Status                           |
| ------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| NFR-01 | Security          | Argon2id, JWT session binding, rotating refresh tokens, backend authorization, input validation, tokenized payments, rate limiting on public endpoints. | Live                             |
| NFR-02 | Performance       | Indexed queries; lazy detail drawers; aggregated dashboard queries.                                                                                     | Live                             |
| NFR-03 | Scalability       | Stateless JWT API, modular NestJS domains, schedule-rule-driven flight generation.                                                                      | Live (design)                    |
| NFR-04 | Reliability       | Transactions around booking/payment/refund; DB constraints prevent duplicate confirmed seats.                                                           | Live                             |
| NFR-05 | Availability      | Mail/payment adapters fail soft; audit logging failure-isolated.                                                                                        | Live                             |
| NFR-06 | Usability         | Clear navigation, validation messages, skeletons, retryable errors, honest empty states.                                                                | Live                             |
| NFR-07 | Responsive design | Customer portal supports desktop/tablet/mobile.                                                                                                         | Live                             |
| NFR-08 | Maintainability   | Monorepo with modular domains, shared types package, ADRs, traceability matrix.                                                                         | Live                             |
| NFR-09 | Auditability      | Immutable audit log with actor/action/target/timestamp.                                                                                                 | Live                             |
| NFR-10 | Privacy           | Owner-scoped data access (BR-12); PII excluded from dashboard payloads; GDPR-oriented handling per SRS.                                                 | Live (policy partially deferred) |
| NFR-11 | Data integrity    | FK discipline (Restrict/ Cascade by design), unique constraints, migrations.                                                                            | Live                             |
| NFR-12 | Backup & recovery | Local PostgreSQL with `pg_dump` logical backups (per SRS design note).                                                                                  | Live (dev strategy)              |
| NFR-13 | Localization      | Multi-language/multi-currency.                                                                                                                          | Deferred                         |

---

## 10. Known Gaps & Deferred Items

1. **Mock-backed pages** (UI works against bundled demo data, no backend yet): customer check-in, boarding pass, baggage tracking, loyalty, notifications list; admin baggage, check-in, loyalty, notifications, reports; admin users page.
2. **Settings API** — the settings page is UI-only; `SystemSetting` persistence endpoints are deferred.
3. **Per-flight status editing** — intentionally not built: no flight-status mutation endpoint exists, and regeneration can overwrite generated statuses. Requires a dedicated backend change.
4. **Extras/baggage purchase in the booking funnel** — extras page controls are disabled and never transmitted.
5. **Offer auto-expiry job** — ACTIVE→EXPIRED transition is not scheduled; public visibility is date-filtered so expiry is still enforced.
6. **Localization / multi-currency (NFR-13)** — future phase.
7. **Rebooking/modification flows** (FR-C16 beyond cancellation) — deferred.
8. **Admin booking action UI** — admin cancel (BR-15) and exception confirm (BR-14) are live in the API; admin bookings page wiring is deferred.

---

## 11. Appendices

### 11.1 API surface (prefix `/api`)

| Module                             | Routes (summary)                                                                                                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth`                             | register, login, refresh, logout, logout-all, email verification, password reset request/confirm, `GET/PATCH /auth/me`, change-password, sessions list/delete, MFA setup/verify/disable |
| `users`                            | staff/user management (permission-guarded)                                                                                                                                              |
| `roles`                            | role & permission catalog                                                                                                                                                               |
| `audit`                            | audit log reads (`audit:read`)                                                                                                                                                          |
| `aircraft` / `airports` / `routes` | public reads + permission-guarded create/update (no hard deletes)                                                                                                                       |
| `schedule-rules`                   | CRUD → flight generation source                                                                                                                                                         |
| `flights`                          | search, detail, seat availability; `POST /flights/generate`                                                                                                                             |
| `bookings`                         | create, own reads, own cancel; admin list/detail under `/admin/bookings`                                                                                                                |
| `payments`                         | customer: pay booking, list own payments; staff: `/admin/payments` (+`/:id/refund`), `/admin/refunds`, admin cancel (BR-15), confirm-exception (BR-14)                                  |
| `offers`                           | public `GET /offers`; admin CRUD `/admin/offers` (delete = deactivate)                                                                                                                  |
| `dashboard`                        | `GET /admin/dashboard?range=7d                                                                                                                                                          | 30d | 90d` |
| `mail`                             | notification adapter (`mock` console or SMTP)                                                                                                                                           |

### 11.2 Data model inventory (37 models)

Identity/RBAC: `User`, `Role`, `Permission`, `UserRole`, `RolePermission`, `Session`, `RefreshToken`, `EmailVerificationToken`, `PasswordResetToken`
Catalog: `Airport`, `Route`, `Aircraft`, `Seat`
Schedule: `ScheduleRule`, `Flight`, `FlightSegment`, `Fare`
Booking: `Booking`, `Passenger`, `BookingPassenger`, `SeatHold`, `BookingSeat`
Money: `Payment`, `Refund`
Operations: `Baggage`, `BaggageEvent`, `CheckIn`, `BoardingPass`, `ExtraService`, `BookingExtra`
Engagement: `Offer`, `NotificationTemplate`, `Notification`, `LoyaltyAccount`, `LoyaltyTransaction`
Governance: `AuditLog`, `SystemSetting`

### 11.3 Technology stack

| Layer    | Technology                                                                                                |
| -------- | --------------------------------------------------------------------------------------------------------- |
| Web      | Angular 22, standalone components, signals, OnPush, lazy routes, Vitest                                   |
| API      | NestJS 11 (ESM), passport-jwt, Argon2id, throttler, nodemailer, Vitest + e2e on a dedicated test database |
| Data     | PostgreSQL, Prisma 6 (UUID PKs, snake_case mapping), 8 migrations                                         |
| Shared   | `@airline/shared` types package                                                                           |
| Monorepo | npm workspaces (`apps/*`, `packages/*`)                                                                   |

### 11.4 Source references

- `docs/SRS_v2.1_extracted.txt` — requirements baseline (FR-C01–C24, UC-01–12, BR-01–15, NFR-01–13, admin sections 5.1–5.16)
- `TRACEABILITY.md` — requirement → implementation mapping with tests
- `PROJECT_OVERVIEW.md` — technical living documentation and change log
- `CONTEXT.md` — canonical domain vocabulary
- `docs/adr/` — architecture decisions (refresh-token rotation, Argon2id, DB-resolved authorization, password-reset storage)
