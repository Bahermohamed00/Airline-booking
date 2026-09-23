# NovaAir Web UI

Angular 22 frontend for the NovaAir educational airline platform — customer portal and role-aware operations dashboard. All data is mock demo data shaped after the Prisma entities; no real airline affiliation, no real payments.

## Run

```bash
# from the repo root
npm install
npm run web:dev        # http://localhost:4200

# tests and production build
npm run web:test
npm run web:build
```

## What to try

**Customer flow (guest-friendly):**
1. `/search` — pick FRA → JFK, tomorrow's date, 1 adult, Economy → **Search flights**.
2. `/results` — filter/sort, expand fare families, **Select**.
3. `/flights/:id` — fare comparison → **Continue**.
4. Passenger details → seat map (hold countdown) → extras → review → **Pay securely** (mock provider).
5. Confirmation page with booking reference.

**Post-booking (sign in first):** demo customer `customer@example.com` + any 8+ char password.
- `/bookings` — upcoming/past/cancelled tabs.
- `/bookings/:id` — manage, cancel with refund estimate.
- `/checkin` — eligibility countdown → boarding pass at `/checkin/:id/pass`.
- `/status` (flight NV100 or FRA→JFK), `/baggage` (demo tag `NV400123456`), `/loyalty`, `/profile`.

**Admin dashboard:** `/admin/login` — pick a staff role (Super Admin, Flight Manager, Booking Manager, Finance Staff, Support Staff). The sidebar, dashboard financials, and module access change per role. Switch roles from the top bar.

## Mock data & API integration

- Mock seed lives in `src/app/core/mock/mock-data.ts` (airports, aircraft+seats, routes, flights+fares, bookings, payments, baggage, loyalty, notifications, audit log).
- All services in `src/app/core/services/` return `Observable`s with simulated latency — swap their internals for `HttpClient` calls to the NestJS API without touching components.
- Flip `environment.useRealApi` / `apiBaseUrl` (`src/environments/environment.ts`) when wiring the real API (`apps/api`, `http://localhost:3000/api`).
- Payment is a tokenized mock provider (`PaymentService`) — raw card data is never collected (NFR-01).

## Structure

```
src/app/
  core/            models, status maps, services, guards, directives, admin nav, mock data
  shared/ui/       design-system components (buttons, badges, alerts, tabs, stepper,
                   dialog, toast, autocomplete, segmented, breadcrumbs, timeline, data table,
                   skeleton, empty state)
  features/
    customer/      shells + booking flow (booking/) + post-booking screens
    admin/         shell + dashboard + flights + catalog/ + ops/ modules
src/styles/        design tokens (_tokens.scss) + global primitives
```

Design tokens are CSS custom properties (`--na-*`): navy foundation, warm off-white surfaces, aviation blue accents, single amber CTA, semantic status colors.
