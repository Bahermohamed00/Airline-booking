# Prisma Ownership & Safety Rules

NovaAir uses a **multi-file Prisma schema**: `prisma/schema/<Model>/<Model>.prisma`
with `prisma/schema/schema.prisma` as the generator/datasource entrypoint.
There are **37 models** and **23 enums**. Each model has exactly one canonical
file; no model or enum is defined twice.

This document assigns every model file a single owner so that two developers
can work in parallel without colliding on the schema. It complements
`.github/CODEOWNERS` (enforcement) and `docs/GIT_WORKFLOW.md` (process).

- **Developer A — Customer & Revenue**
- **Developer B — Operations & Platform**

> Replace `Developer A` / `Developer B` with the real names/GitHub usernames
> once they are confirmed (see `.github/CODEOWNERS`).

---

## 1. Model ownership map

### Developer A — Customer & Revenue (12 models)

| Model file | Notes |
| ---------- | ----- |
| `Booking/Booking.prisma` | **Shared hub** — referenced by many B models. |
| `Passenger/Passenger.prisma` | **Shared hub** — referenced by B check-in/baggage. |
| `BookingPassenger/BookingPassenger.prisma` | Join (Booking ↔ Passenger). |
| `BookingSeat/BookingSeat.prisma` | References B `FlightSegment`, `Seat`. |
| `SeatHold/SeatHold.prisma` | References B `Flight`, `Seat`. |
| `Payment/Payment.prisma` | References A `Booking`. |
| `Refund/Refund.prisma` | References A `Payment`/`Booking`. |
| `Offer/Offer.prisma` | Standalone catalog. |
| `ExtraService/ExtraService.prisma` | Extra-services catalog. |
| `BookingExtra/BookingExtra.prisma` | Join (Booking ↔ ExtraService). |
| `Notification/Notification.prisma` | References B `User`. |
| `NotificationTemplate/NotificationTemplate.prisma` | Standalone. |

> The original plan listed a separate `Extra` model. The implemented schema has
> no standalone `Extra` table — extras are `ExtraService` (catalog) +
> `BookingExtra` (join). Both are Developer A.

### Developer B — Operations & Platform (25 models)

| Model file | Notes |
| ---------- | ----- |
| `User/User.prisma` | **Shared hub** — referenced by A `Booking`, `Notification`. |
| `Role/Role.prisma` | Identity/RBAC. |
| `Permission/Permission.prisma` | Identity/RBAC catalog. |
| `UserRole/UserRole.prisma` | Join. |
| `RolePermission/RolePermission.prisma` | Join. |
| `Session/Session.prisma` | Auth. |
| `RefreshToken/RefreshToken.prisma` | Auth. |
| `EmailVerificationToken/EmailVerificationToken.prisma` | Auth. |
| `PasswordResetToken/PasswordResetToken.prisma` | Auth. |
| `Airport/Airport.prisma` | Catalog. |
| `Aircraft/Aircraft.prisma` | Catalog. |
| `Seat/Seat.prisma` | **Shared hub** — referenced by A `BookingSeat`, `SeatHold`. |
| `Route/Route.prisma` | Catalog. |
| `ScheduleRule/ScheduleRule.prisma` | Flight generation. |
| `Flight/Flight.prisma` | **Shared hub** — referenced by A booking/seat models. |
| `FlightSegment/FlightSegment.prisma` | Operations. |
| `Fare/Fare.prisma` | **Shared hub** — referenced by A `Booking` (fare snapshot). |
| `CheckIn/CheckIn.prisma` | References A `Booking`/`Passenger`. |
| `BoardingPass/BoardingPass.prisma` | Operations. |
| `Baggage/Baggage.prisma` | References A `Booking`/`Passenger`. |
| `BaggageEvent/BaggageEvent.prisma` | Operations. |
| `LoyaltyAccount/LoyaltyAccount.prisma` | References B `User`. |
| `LoyaltyTransaction/LoyaltyTransaction.prisma` | Loyalty. |
| `AuditLog/AuditLog.prisma` | Platform (append-only). |
| `SystemSetting/SystemSetting.prisma` | Platform. |

---

## 2. Enum ownership

Enums live **inside** a model file, so enum ownership follows the file that
defines it. Renaming/removing an enum value is a **breaking change** to every
consumer, including across the ownership boundary.

### Cross-boundary (shared) enums — changes require BOTH owners' review

| Enum | Defined in (owner) | Consumed across boundary by |
| ---- | ------------------ | --------------------------- |
| `CabinClass` | `Seat/Seat.prisma` (B) | A `Booking`, `BookingSeat`, `SeatHold`, B `Fare` |
| `BookingStatus` | `Booking/Booking.prisma` (A) | B `CheckIn`, `Baggage` |

### Single-owner enums (owner reviews; additive values still preferred)

- **A-owned:** `BookingStatus`, `PassengerType`, `PaymentStatus`, `RefundStatus`,
  `SeatHoldStatus`, `OfferStatus`, `ExtraServiceStatus`,
  `NotificationChannel`, `NotificationStatus`.
- **B-owned:** `UserStatus`, `AircraftStatus`, `AirportStatus`, `RouteStatus`,
  `CabinClass`, `FlightStatus`, `FlightScheduleStatus`, `Weekday`,
  `ScheduleRuleStatus`, `CheckInStatus`, `BaggageType`, `BaggageStatus`,
  `LoyaltyTier`, `LoyaltyTransactionType`.

---

## 3. Shared FK hub models

These models sit on the ownership boundary: one developer owns the table, the
other references it. **Breaking changes to a hub require both owners' review.**
Additive (nullable / new optional relation) changes are preferred.

- `Booking` (A) ← referenced by B `CheckIn`, `Baggage`, `BoardingPass` and A `Payment`, `Refund`.
- `Passenger` (A) ← referenced by B `CheckIn`, `Baggage`.
- `Flight` (B) ← referenced by A `Booking`, `BookingSeat`, `SeatHold`.
- `FlightSegment` (B) ← referenced by A `BookingSeat`.
- `Seat` (B) ← referenced by A `BookingSeat`, `SeatHold`.
- `Fare` (B) ← referenced by A `Booking` (fare-rules snapshot).
- `User` (B) ← referenced by A `Booking`, `Notification`.

---

## 4. Migration ownership

- A migration is owned by the developer whose model(s) it changes.
- A migration that touches **both** owners' models (a shared hub) needs a
  review from the other owner before merge.
- **One logical migration per PR**, named for its domain (see rules below).
- The CI migration guard (`prisma migrate deploy` + `prisma migrate diff`)
  must pass on every PR (see `docs/GIT_WORKFLOW.md` and `.github/workflows/ci.yml`).

---

## 5. Safety rules (both developers)

1. **One owner per model.** Edit only the files you own.
2. **Do not directly modify another developer's model** without their review.
   Open a PR and request the owner as a reviewer instead.
3. **Shared hub models require both developers' review** for breaking changes
   (column drop/rename/retype, relation cardinality change, enum value
   removal/rename).
4. **Additive changes preferred.** New nullable columns / new optional
   relations / new enum values over destructive edits.
5. **No migration rewriting after merge.** Once a migration is on `main`, it is
   immutable. Fix forward with a new migration.
6. **Never manually merge migration SQL** from two developers. Resolve at the
   schema level, then regenerate a single migration.
7. **Rebase before creating a migration** so your branch contains the latest
   `main` migrations.
8. **If `main` gained migrations after you branched:** rebase → reset your local
   DB (`npm run db:reset`) → replay migrations → regenerate your own migration
   so it builds on the newest `main` migration.
9. **One logical migration per PR.**
10. **Migration names must be domain-oriented**, e.g.:

    ```text
    booking_add_cancel_reason
    payments_add_refund_reference
    checkin_add_boarding_status
    flights_add_schedule_timezone
    ```

### Changing a model you do not own — checklist

1. Discuss with the owner first (issue or chat).
2. Prefer an additive change in your own model over editing theirs.
3. If an edit is unavoidable, open a PR that touches **only** that model file +
   its migration, and add the owner as a required reviewer (CODEOWNERS does this
   automatically for `prisma/schema/<Model>/`).
4. Confirm the migration guard passes in CI.
