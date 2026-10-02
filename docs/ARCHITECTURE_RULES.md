# Architecture Rules

Binding conventions for NovaAir. They exist so two developers can work in
parallel without breaking each other or the build. Companion docs:
`docs/PRISMA_OWNERSHIP.md` (schema), `docs/GIT_WORKFLOW.md` (process),
`docs/ARCHITECTURE_DECISIONS.md` (decision log).

- **Developer A — Customer & Revenue:** bookings, seat management, payments,
  refunds, offers, notifications, extras.
- **Developer B — Operations & Platform:** identity/RBAC, users/staff, fleet &
  catalog, flight operations, check-in, baggage, loyalty, dashboard, audit,
  settings, CI, seed, shared UI, platform config.

---

## 1. Frontend layering

```text
Component
   ↓
Service (Angular @Injectable)
   ↓
HTTP (HttpClient + API_CONFIG.baseUrl)
   ↓
NestJS Controller
```

Never:

```text
Component → raw HttpClient URL   (always go through a service + API_CONFIG)
Component → Prisma
Component → database
```

- Components render and delegate; they do not build URLs or contain data logic.
- All HTTP goes through `HttpClient` with the `API_CONFIG` injection token.
- The web keeps its own view-model types in `core/models/`; `*-api.model.ts`
  files map API payloads to view models at the boundary.

## 2. Backend module boundaries

A module should:

- **Own its own business tables** (see `docs/PRISMA_OWNERSHIP.md`).
- **Expose services** where cross-module access is required, via the module's
  `exports`.
- **Avoid direct imports into another module's internal files.**

Avoid:

```text
Module A → ../module-b/internal-file.ts
```

Prefer:

```text
Module A
   ↓
Module B (exported service / provider)
```

## 3. Cross-module reads

- Allowed when justified.
- Prefer an **exported service** over **direct Prisma access** when business
  logic is required.
- Read-only analytics/reporting queries may use direct Prisma access to another
  module's tables **when documented** (e.g. the dashboard aggregates over
  bookings/refunds/baggage).

## 4. Cross-module writes

- **Avoid.** A module writes to its own tables.
- **Documented exception — payment lifecycle:** the payments module mutates
  booking status as part of the paid booking lifecycle (BR-14 confirm-exception,
  BR-15 admin-cancel-with-auto-refund). This is an intentional, audited
  exception — do **not** redesign it outside a dedicated payments phase.

## 5. Registering a new NestJS module (`app.module.ts`)

New modules must be registered with the **smallest possible diff**:

- **One import** line and **one entry** in the `imports: []` array.
- Keep the existing ordering style (platform → identity → catalog → operations);
  insert the new module next to its domain peers.
- **Do not reorder or reformat existing registrations** in the same PR — that
  creates needless conflicts for the other developer.

## 6. Angular routes

Routes are split by owner so the two developers do not share a router file
(see `docs/GIT_WORKFLOW.md`):

- `apps/web/src/app/app.routes.ts` — thin root composition only.
- `apps/web/src/app/admin.routes.ts` — Developer B (admin console).
- `apps/web/src/app/customer.routes.ts` — Developer A (customer funnel/account).

Add new routes to the owning file, preserving path, guards, permission checks
and lazy loading. Auth routes stay inside the customer shell to preserve guard
and `returnUrl` behavior.

## 7. Audit event catalog — ownership

- **Backend `apps/api/src/audit/audit-events.ts` is the canonical source** of
  audit event names. It may only grow (historical names must stay readable).
- **Frontend `apps/web/src/app/core/services/audit.service.ts` is a mirror**
  used for the filter dropdown. **Whenever an event is added to the backend
  catalog, update the frontend mirror in the same PR.** The two arrays must
  stay identical (currently 37 events).

---

## Deferred architectural tasks (intentionally not changed in Foundation)

These were reviewed and deliberately left as-is to minimize Foundation risk.
They are **not** blocking and are all **same-owner** concerns, so they do not
create parallel-development conflicts.

| Item | Location | Why deferred | Suggested future action |
| ---- | -------- | ------------ | ----------------------- |
| Airport view mapper shared via service file | `flights.service.ts`, `routes.service.ts` import `toAirportView` from `airports/airports.service.ts` | Pure read-mapper; all three modules are Developer B (catalog/ops) — same owner, no conflict | Extract `toAirportView`/`AirportView` into `airports/airport-view.ts` and import from there |
| Refund-policy helper location | `bookings.service.ts`, `prisma/seed/*` import `refundPolicyFromFareRules` from `payments/refund-policy.ts` | Pure, well-tested helper (8 unit tests); primary consumers (bookings, payments) are both Developer A | Move to a neutral `fare`/`refund-policy` module if a third owner ever needs it |
| Shared `admin/bookings` controller prefix | `bookings/admin-bookings.controller.ts` (GET reads) + `payments/admin-booking-lifecycle.controller.ts` (POST lifecycle) | **No route collision** (GET vs POST sub-paths); both modules are Developer A; the split (reads vs lifecycle mutations) is intentional and documented in the controllers | None required — keep reads in bookings, lifecycle mutations in payments |
