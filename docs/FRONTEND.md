# Frontend Guide — NovaAir Web (apps/web)

Everything about the Angular frontend: architecture, lifecycle, data flow, and conventions.

## 1. What it is

An **Angular 22** single-page application with two experiences in one bundle: a **customer travel portal** and a **role-aware admin operations dashboard**, under the original "NovaAir" brand. It runs on **mock data or the real NestJS API**, switched by one flag.

| Layer | Technology |
|---|---|
| Framework | Angular 22 — standalone components, signals, `@if`/`@for` control flow |
| Language | TypeScript strict |
| Styling | SCSS, design tokens as CSS custom properties (`--na-*`), no UI library |
| State | Signals (`signal`, `computed`) — no NgRx |
| HTTP | `HttpClient` + functional interceptor |
| Forms | Reactive Forms (`FormBuilder`); Signal Forms preferred for new work |
| Tests | Vitest (31 specs) |
| Backend | Optional — mock-first services switch to `http://localhost:3000/api` |

## 2. Directory layout

```
apps/web/src/
  styles.scss                    # global primitives (.na-card, .na-field, …)
  styles/_tokens.scss            # design tokens (--na-* custom properties)
  environments/environment.ts    # useRealApi flag, apiBaseUrl, brand, currency
  app/
    app.ts / app.config.ts       # root component + providers (router, HttpClient)
    app.routes.ts                # full route map, lazy loadComponent everywhere
    core/                        # framework-agnostic app core
      models/                    # domain.model.ts, booking-flow.model.ts
      mock/mock-data.ts          # realistic entity-shaped demo data
      services/                  # business services (real/mock switchable)
      guards/auth.guard.ts       # authGuard, staffGuard, permissionGuard
      directives/                # *naHasPermission structural directive
      admin-nav.ts               # admin sidebar items + role permission map
      status-maps.ts             # status → label/color maps (single source)
    shared/ui/                   # design-system components (15)
    features/
      customer/
        customer-shell.component.ts
        booking/                 # search→results→details→passengers→seats
                                 # →extras→review→confirmation (8 screens)
        login, register, my-bookings, manage-booking, manage-lookup,
        checkin, boarding-pass, flight-status, baggage, loyalty,
        profile, help
      admin/
        admin-shell.component.ts
        admin-login.component.ts (role picker in mock / real form in real mode)
        denied.component.ts
        dashboard/               # KPIs, SVG trend charts, ops board, alerts
        flights/                 # flight management
        catalog/                 # airports, aircraft, routes
        ops/                     # bookings, users, staff, roles, payments,
                                 # refunds, baggage, check-in, loyalty,
                                 # notifications, reports, audit, settings
```

## 3. Application lifecycle

### 3.1 Bootstrap

1. `main.ts` → `bootstrapApplication(App, appConfig)`.
2. `app.config.ts` providers: router (all routes **lazy** via `loadComponent`), `provideHttpClient(withInterceptors([authInterceptor]))`, global error listeners.
3. Root `App` renders `<router-outlet>` + `<na-toast-host>` (global toasts).

### 3.2 Routing lifecycle per navigation

```
URL change
  → Route match (lazy feature bundle downloads on first visit)
  → Guards run:
      (none)         public pages: /search, /results, /flights/:id, /status, …
      authGuard      customer account pages: /bookings, /loyalty, /profile
                     → not logged in? redirect /login?returnUrl=…
      staffGuard     everything under /admin except /admin/login
                     → not staff? redirect /admin/login (or /admin/denied)
  → Shell component renders (CustomerShell or AdminShell)
  → Feature screen component renders inside the shell's <router-outlet>
```

- **CustomerShell**: navy top bar (brand, Flight Search, Manage Booking, Check-in, Flight Status, Baggage, Loyalty, Help, account menu) + mobile bottom nav.
- **AdminShell**: collapsible permission-filtered sidebar, top bar (global search, DEMO DATA pill, **role switcher**, staff profile, sign out).

### 3.3 Screen data lifecycle

Every screen follows the same pattern:

```
ngOnInit / route param subscription
  → loading signal = true → NaSkeleton renders
  → service.method() (Observable)
  → success: data signal set → content renders
  → empty: NaEmptyState with a next action
  → error: NaAlert with (retry) that re-issues the call
```

## 4. The mock/real switch (key architectural decision)

`environments/environment.ts`:

```ts
useRealApi: true,                      // dev: real API; flip to false for pure-mock
apiBaseUrl: 'http://localhost:3000/api',
```

Every data service keeps **two paths behind one interface**:

```ts
searchFlights(criteria) {
  if (this.useRealApi) return this.http.get<Flight[]>(`${base}/flights/search`, { params });
  return of(mockFiltered).pipe(delay(400));   // same shape, simulated latency
}
```

Components never know the difference — same types, same Observable contract.

| Service | Real API (when flag on) | Mock fallback |
|---|---|---|
| `FlightService` | search, airports, adjacent, flight details, **status by number/route** | `FLIGHTS`/`AIRPORTS` arrays, same filter logic |
| `AuthService` | `POST /auth/login|register|password-reset-request|mfa/setup`, `GET /auth/me`; JWT persisted in localStorage | seeded demo users, any 8+ char password; `loginAsRole()` for demo staff roles |
| `AdminCatalogService` | all `/admin/*` CRUD (airports, routes, aircraft, flights, fares) | module-level mutable copies of mock data |
| `BookingService`, `CheckInService`, `BaggageService`, `LoyaltyService`, `NotificationService`, `PaymentService`, `AdminService` | *(still mock-only — Phases 3–5 backend)* | mock data + in-session mutations |

**Auth in real mode:** `login()` posts credentials, then fetches `/auth/me` for profile + roles + permissions, and stores the JWT + user in `localStorage` (survives reloads). The **`authInterceptor`** attaches `Authorization: Bearer <token>` to every request to `apiBaseUrl`. In mock mode it's a no-op.

## 5. Booking flow lifecycle (the core journey)

Driven by `BookingDraftService` — a session-scoped signal store holding the in-progress booking:

```
/search            SearchCriteria chosen (trip type, airports, dates, pax, cabin, promo)
   │  one-way | round-trip | multi-city (up to 3 legs, chronological validation)
   ▼
/results           per-leg sections; filters/sort applied (client-side helpers);
   │               must pick one fare per leg (round trip = outbound + return)
   ▼
/flights/:id       flight details + fare family comparison (one-way path)
   ▼
draft.start(...)   BookingDraft created: flights, fares, empty passenger forms, legs[]
   ▼
/booking/passengers  stepper 1 — reactive FormArray, per-field validation,
   │                  saved-traveller autofill
   ▼
/booking/seats       stepper 2 — visual seat map (SeatService.stateOf per seat),
   │                  per-leg tabs, seat fees; setSeats() starts a 15-MINUTE HOLD
   │                  (BR-13); countdown ticks, expires → releaseHold + alert
   ▼
/booking/extras      stepper 3 — allowance from fare rules, add-ons, extra bags,
   │                  live order summary (PricingService.computeBreakdown)
   ▼
/booking/review      stepper 4 — full summary, fare rules, consent checkbox;
   │                  PaymentService.tokenize() → charge(token, total, currency,
   │                  idempotencyKey) — mock PCI provider, NO raw card data;
   │                  retry is idempotent (same key)
   ▼
BookingService.confirmFromDraft(draft)  → Booking with unique reference, SUCCESS payment
   ▼
/booking/confirmation   reference, itinerary, print, .ics download; draft.clear()
```

Post-booking flows read from `BookingService`: My Bookings (tabs by status/date), Manage Booking (cancel with **refund estimate from fare rules**), check-in (eligibility window: opens 24h before, closes 1h before — BR-07), boarding pass (QR placeholder, print/share), flight status, baggage tracking, loyalty, profile/security (MFA setup, password reset, GDPR actions).

## 6. Design system

**Tokens** (`styles/_tokens.scss`): navy foundation (`--na-navy-*`), warm off-white surfaces, aviation blue accents, single amber CTA (`--na-cta`), semantic statuses (`--na-success/warning/danger/info` + `*-bg`), type scale, 4px spacing scale, radii, restrained shadows, focus ring, reduced-motion support, breakpoints (639px / 1024px).

**Components** (`shared/ui/`, all standalone, `input()`/`output()`, OnPush): `NaButton` (5 variants × 3 sizes, loading), `NaBadge` (status tones), `NaAlert` (dismissible/retryable), `NaTabs`, `NaStepper`, `NaDialog` (confirm patterns), `NaSkeleton`, `NaEmptyState`, `NaAutocomplete`, `NaSegmented`, `NaBreadcrumbs`, `NaTimeline`, `NaDataTable` (priority columns → hidden on mobile), `ToastService` + `NaToastHost`.

**Status presentation is centralized** in `core/status-maps.ts` (`FLIGHT_STATUS_MAP`, `BOOKING_STATUS_MAP`, …) — templates never hardcode colors/labels.

## 7. RBAC in the UI

UI visibility mirrors backend RBAC (the backend remains the real boundary):

- `staffGuard` gates `/admin/*`; `permissionGuard(perm)` for module routes.
- `*naHasPermission="'payments:read'"` structural directive hides/shows UI blocks (e.g., dashboard financials, exception workflow buttons, settings).
- Admin sidebar renders only items the user's permissions allow (`ADMIN_NAV` + `hasPermission`).
- `super_admin` passes every check (BR-09).
- The admin top-bar **role switcher** (mock mode) swaps the acting staff role to demonstrate permission differences; real mode uses actual credentials instead.

## 8. Conventions (best-practices.md — enforced for all changes)

- Standalone components (no `standalone: true` flag — default in v20+), no explicit `OnPush` (default in v22+)
- `inject()` over constructor injection; `input()`/`output()`; `computed()` for derived state; `set`/`update` on signals, never `mutate`
- Reactive Forms; Signal Forms for new forms; no `ngClass`/`ngStyle`; no `CommonModule` imports
- Only `--na-*` tokens for colors; `.na-*` global form/layout classes
- Native control flow (`@if`, `@for`, `@switch`); accessibility: labels, aria, ≥44px targets, focus-visible, WCAG AA

## 9. Testing

`npm run web:test` (Vitest, **31 specs**):

| Spec | Covers |
|---|---|
| `pricing.service.spec.ts` | fare math: pax-type discounts, seat charges, extras, bags, promo, round trips, refund estimates |
| `seat-hold.spec.ts` | BR-13 hold creation, countdown, expiry, release |
| `permission.spec.ts` | role scoping, super_admin bypass, logged-out denial (forces mock mode) |
| `status-maps.spec.ts` | status → tone/label integrity, unknown-key fallback |
| `app.spec.ts` | root component + toast host render |

## 10. How to run

```bash
npm install
npm run web:dev     # http://localhost:4200  (uses real API per environment.ts)
npm run web:build   # production bundle → dist/web
npm run web:test    # 31 specs
```

Pure-mock mode (no backend needed): set `useRealApi: false` in `src/environments/environment.ts` — every screen keeps working off `core/mock/mock-data.ts`.

## 11. Known gaps / follow-ups

- Ops-module services (bookings, payments, baggage, notifications, reports, audit) are mock-only until Phases 3–5 backend endpoints exist.
- `Booking` mock model stores outbound seats only (model limitation; totals include all legs).
- Style-budget warnings in build (some screens exceed the default 4 kB component-SCSS budget) — cosmetic, can be raised in `angular.json`.
- Dashboard KPIs are mock aggregates pending the reports/admin-stats API.
