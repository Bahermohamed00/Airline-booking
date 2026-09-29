import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BookingDraftService } from '../../../core/services/booking-draft.service';
import { ExtrasService } from '../../../core/services/domain-services';
import { PricingService, formatMoney } from '../../../core/services/pricing.service';
import type { ExtraService } from '../../../core/models/domain.model';
import type { ExtraSelection } from '../../../core/models/booking-flow.model';
import { NaStepper } from '../../../shared/ui/stepper.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaQuantityStepper } from '../../../shared/ui/quantity-stepper.component';
import { BOOKING_STEPS } from './passengers.component';

@Component({
  selector: 'na-extras-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NaStepper, NaButton, NaSkeleton, NaAlert, NaQuantityStepper],
  template: `
    <div class="na-container page">
      <na-stepper [steps]="steps" [currentIndex]="3" />
      <h1>Baggage & extras</h1>
      <p class="page__sub na-text-muted">Add bags and services to your trip — everything here is optional.</p>

      <div class="layout">
        <div class="main">
          @if (fareRules(); as rules) {
            <section class="na-card allowance" aria-labelledby="allow-h">
              <h2 id="allow-h">Included in your fare</h2>
              <ul>
                <li>{{ rules.checkedBaggagePieces }}× checked bag up to {{ rules.checkedBaggageWeightKg }} kg per passenger</li>
                <li>{{ rules.carryOnPieces }}× carry-on bag per passenger</li>
                @if (rules.priorityBoarding) { <li>Priority boarding</li> }
                @if (rules.loungeAccess) { <li>Lounge access</li> }
              </ul>
            </section>
          }

          <section class="na-card panel" aria-labelledby="bags-h">
            <h2 id="bags-h">Extra checked bags</h2>
            <p class="na-text-muted na-text-small">Additional bags beyond your allowance — {{ money(65) }} per bag.</p>
            <ul class="bag-rows">
              @for (p of passengers(); track $index; let i = $index) {
                <li>
                  <na-quantity-stepper
                    [label]="'Extra bags for ' + (p.firstName || 'Passenger ' + (i + 1))"
                    [value]="baggage()[i]"
                    [min]="0"
                    [max]="3"
                    (valueChange)="setBags(i, $event)"
                  />
                </li>
              }
            </ul>
          </section>

          <section aria-labelledby="extras-h">
            <h2 id="extras-h">Add-on services</h2>
            @if (extrasError()) {
              <na-alert tone="danger" icon="⚠" title="We couldn't load add-on services" [retryable]="true" (retry)="loadExtras()">
                The extras catalogue is unavailable right now. You can retry, or continue without add-ons.
              </na-alert>
            } @else if (extras() === null) {
              <na-skeleton [rows]="[1, 2]" height="90px" />
            } @else if (extras()!.length === 0) {
              <p class="na-text-muted na-text-small">No add-on services are available for this flight — you can continue to review.</p>
            } @else {
              <div class="extra-cards">
                @for (e of extras()!; track e.id) {
                  <article class="na-card extra">
                    <div class="extra__body">
                      <h3>{{ e.name }}</h3>
                      <p class="na-text-small na-text-muted">{{ e.description }}</p>
                      <p class="extra__price">{{ money(e.price) }}</p>
                    </div>
                    <na-quantity-stepper
                      [label]="e.name"
                      [value]="qtyOf(e.id)"
                      [min]="0"
                      [max]="5"
                      (valueChange)="setQty(e, $event)"
                    />
                  </article>
                }
              </div>
            }
          </section>
        </div>

        <aside class="na-card side" aria-label="Order summary" aria-live="polite">
          <h2>Order summary</h2>
          @if (breakdown(); as b) {
            <table class="side__table">
              <tbody>
                <tr><td>Fares ({{ passengerCount() }} traveller{{ passengerCount() > 1 ? 's' : '' }})</td><td>{{ money(b.baseFare) }}</td></tr>
                @if (b.seatCharges > 0) { <tr><td>Seat selection</td><td>{{ money(b.seatCharges) }}</td></tr> }
                @if (b.baggage > 0) { <tr><td>Extra baggage</td><td>{{ money(b.baggage) }}</td></tr> }
                @if (b.extras > 0) { <tr><td>Add-ons</td><td>{{ money(b.extras) }}</td></tr> }
                @if (b.discount > 0) { <tr class="side__discount"><td>Promo discount</td><td>−{{ money(b.discount) }}</td></tr> }
                <tr class="side__total"><td>Total</td><td>{{ money(b.total) }}</td></tr>
              </tbody>
            </table>
            <p class="na-hint">Includes {{ money(b.taxes) }} taxes and {{ money(b.fees) }} fees.</p>
          }
          <div class="side__actions">
            <na-button variant="secondary" (clicked)="back()">Back</na-button>
            <na-button variant="cta" (clicked)="continue()">Review booking</na-button>
          </div>
        </aside>
      </div>
    </div>
  `,
  styles: `
    .page { padding-top: var(--na-space-6); padding-bottom: var(--na-space-12); }
    h1 { margin-bottom: var(--na-space-1); }
    .page__sub { margin-bottom: var(--na-space-5); }
    h2 { font-size: var(--na-text-xl); margin-bottom: var(--na-space-3); }
    .layout { display: grid; grid-template-columns: 1fr 320px; gap: var(--na-space-5); align-items: start; }
    .main { display: grid; gap: var(--na-space-5); align-content: start; }
    .panel, .allowance { padding: var(--na-space-6); }
    .allowance ul { margin: 0; padding-left: var(--na-space-5); display: grid; gap: var(--na-space-1); font-size: var(--na-text-sm); }
    .bag-rows { list-style: none; margin: var(--na-space-3) 0 0; padding: 0; display: grid; gap: var(--na-space-3); }
    .extra-cards { display: grid; gap: var(--na-space-3); margin-top: var(--na-space-3); }
    .extra { padding: var(--na-space-6); display: flex; justify-content: space-between; align-items: center; gap: var(--na-space-4); }
    .extra__body h3 { font-size: var(--na-text-base); margin-bottom: var(--na-space-1); }
    .extra__price { font-weight: var(--na-font-bold); margin-top: var(--na-space-1); }
    .side { padding: var(--na-space-6); position: sticky; top: var(--na-space-4); }
    .side h2 { font-size: var(--na-text-xl); margin-bottom: var(--na-space-4); }
    .side__table { width: 100%; border-collapse: collapse; font-size: var(--na-text-sm); margin-bottom: var(--na-space-2); }
    .side__table td { padding: var(--na-space-1) 0; }
    .side__table td:last-child { text-align: right; font-weight: var(--na-font-medium); }
    .side__discount td { color: var(--na-success); }
    .side__total td { border-top: 1px solid var(--na-border); padding-top: var(--na-space-2); font-size: var(--na-text-lg); font-weight: var(--na-font-bold); }
    .side__actions { display: grid; gap: var(--na-space-2); margin-top: var(--na-space-4); }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
      .side { position: static; order: -1; }
    }
    @media (max-width: 639px) {
      .extra { flex-direction: column; align-items: stretch; }
    }
  `,
})
export class ExtrasPage {
  private readonly router = inject(Router);
  private readonly draft = inject(BookingDraftService);
  private readonly extrasApi = inject(ExtrasService);
  private readonly pricing = inject(PricingService);

  protected readonly steps = BOOKING_STEPS;
  protected readonly passengers = this.draft.passengers;
  protected readonly extras = signal<ExtraService[] | null>(null);
  protected readonly extrasError = signal(false);
  protected readonly quantities = signal<Record<string, number>>({});
  protected readonly baggage = signal<number[]>([]);

  protected readonly fareRules = computed(() => this.draft.fare()?.rules ?? null);

  protected readonly passengerCount = computed(() => this.passengers().length);

  protected readonly extraSelections = computed<ExtraSelection[]>(() => {
    const list = this.extras() ?? [];
    const qty = this.quantities();
    return list.filter((e) => (qty[e.id] ?? 0) > 0).map((e) => ({ extra: e, quantity: qty[e.id] }));
  });

  protected readonly breakdown = computed(() => {
    const d = this.draft.draft();
    if (!d) return null;
    return this.pricing.computeBreakdown({
      fare: d.fare,
      returnFare: d.returnFare,
      passengerTypes: d.passengers.map((p) => p.passengerType),
      seats: d.seats,
      returnSeats: d.returnSeats,
      extras: this.extraSelections(),
      extraBags: this.baggage().reduce((a, b) => a + b, 0),
      promoCode: d.criteria.promoCode,
    });
  });

  constructor() {
    const d = this.draft.draft();
    if (!d) {
      this.router.navigateByUrl('/search');
      return;
    }
    this.baggage.set([...d.baggagePieces]);
    this.loadExtras();
  }

  protected loadExtras(): void {
    const d = this.draft.draft();
    if (!d) return;
    this.extrasError.set(false);
    this.extrasApi.list().subscribe({
      next: (list) => {
        this.extras.set(list);
        const initial: Record<string, number> = {};
        for (const sel of d.extras) initial[sel.extra.id] = sel.quantity;
        this.quantities.set(initial);
      },
      error: () => {
        this.extras.set(null);
        this.extrasError.set(true);
      },
    });
  }

  protected qtyOf(extraId: string): number {
    return this.quantities()[extraId] ?? 0;
  }

  protected setQty(extra: ExtraService, value: number): void {
    this.quantities.update((q) => ({
      ...q,
      [extra.id]: Math.min(5, Math.max(0, value)),
    }));
  }

  protected setBags(index: number, value: number): void {
    this.baggage.update((bags) => {
      const next = [...bags];
      next[index] = Math.min(3, Math.max(0, value));
      return next;
    });
  }

  protected money(amount: number): string {
    const currency = this.draft.fare()?.currency ?? 'EUR';
    return formatMoney(amount, currency);
  }

  protected continue(): void {
    this.draft.setExtras(this.extraSelections());
    this.draft.setBaggage(this.baggage());
    this.router.navigateByUrl('/booking/review');
  }

  protected back(): void {
    this.router.navigateByUrl('/booking/seats');
  }
}
