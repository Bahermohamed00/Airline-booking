# Bookable offers (BR-16)

Offers shipped in Phase 5 as marketing/catalog data only, deliberately decoupled from pricing. An approved product contract (BR-16, 2026-10-08) makes them bookable: an offer may carry a discount of type PERCENT or FIXED_AMOUNT (`discountType = null` keeps it marketing-only and not bookable; no promo codes, no stacking, at most one offer per booking). The discount applies to the base fare only — taxes and fees are never discounted — and is computed server-side in integer cents inside the existing booking-creation transaction: PERCENT → `discountCents = round(baseCents × pct/100)`; FIXED_AMOUNT → exact cents conversion; `discountedBase = basePrice − discount`; `perPassengerTotal = discountedBase + taxAmount + feeAmount`; `totalAmount = perPassengerTotal × passengerCount` (must be > 0). The client sends only `offerId` (UUID v4), which is included in the booking idempotency request hash when present; `POST /api/bookings/price-preview` exposes the same computation as an authenticated, read-only quote.

Eligibility lives on the offer itself: optional `routeId` and/or `cabinClass` columns (NULL = unrestricted; both set = AND-combined) — no flight-specific offers, no join tables. Redemption is recorded as `Booking.offerId` — no OfferRedemption table and no redemption limits (per-customer or global). Offer terms are snapshotted at creation into `Booking.fareRulesSnapshot.offer` ({ id, title, discountType, discountValue, discountAmountPerPassenger, currency }), so later offer edits or deactivation never change an existing booking; `Booking.totalAmount`/`currency`/snapshot remain authoritative, and the Payment/Refund modules are unchanged (they consume the persisted `Booking.totalAmount` / paid `Payment.amount`). Delete semantics are usage-gated: the existing `DELETE /api/admin/offers/:id` soft deactivate (ACTIVE→INACTIVE, 409 if already INACTIVE) is unchanged; the new `DELETE /api/admin/offers/:id/permanent` hard-deletes only when zero bookings reference the offer, otherwise 409 `OFFER_IN_USE` with `bookingCount` — with FK `Booking.offerId → Offer.id ON DELETE RESTRICT` as the DB backstop and an `OFFER_HARD_DELETED` audit event.

## Considered Options

- Promo codes / coupon engine with an OfferRedemption table: supports stacking and per-customer redemption limits, but a much larger pricing and abuse surface — deferred.
- Client-computed discounts: violates server-side price authority (client-supplied totals are already rejected on booking creation) — rejected.
- Flight-specific offers via a join table: finer targeting at the cost of extra schema and validation complexity — deferred.

## Consequences

- Schema ownership crossing: `Route.prisma` (Developer B — Operations & Platform per `docs/PRISMA_OWNERSHIP.md`) gained a minimal `offers Offer[]` back-relation for offer route eligibility — coordinate changes with Developer B.
- Payments and refunds are untouched: they consume the persisted `Booking.totalAmount` / paid `Payment.amount`; offer edits or deactivation never affect existing bookings because the snapshot is authoritative.
- No redemption limits exist (per-customer or global); exposure is controlled only through the offer lifecycle and validity window.
- Supersedes the Phase 5 "Scope isolation (no pricing integration)" rule recorded in `TRACEABILITY.md` and the "deliberately not coupled to pricing" note in `docs/BDocs.md` (both marked superseded 2026-10-08).
- Deferred: promo codes, stacking, flight-specific offers, redemption limits, OfferRedemption table.
