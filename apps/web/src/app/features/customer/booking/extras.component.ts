import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BookingDraftService } from './booking-draft.service';
import { ExtrasCatalogService } from '../../../core/services/extras-catalog.service';
import { formatMoney } from '../../../core/services/pricing.service';
import type { ExtraCatalogItem, ExtraCategory, ExtrasQuote } from '../../../core/models/extras.model';
import type { ExtraSelection } from '../../../core/models/booking-flow.model';
import { NaStepper } from '../../../shared/ui/stepper.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaQuantityStepper } from '../../../shared/ui/quantity-stepper.component';
import { BOOKING_STEPS } from './passengers.component';

const CATEGORY_META: Record<ExtraCategory, { title: string; icon: string }> = {
  BAGGAGE: { title: 'Extra checked bags', icon: '🧳' },
  MEAL: { title: 'Meals & drinks', icon: '🍽' },
  PRIORITY: { title: 'Priority services', icon: '⚡' },
  INSURANCE: { title: 'Travel insurance', icon: '🛡' },
};

const CATEGORY_ORDER: ExtraCategory[] = ['BAGGAGE', 'MEAL', 'PRIORITY', 'INSURANCE'];

@Component({
  selector: 'na-extras-page',
  imports: [NaStepper, NaButton, NaAlert, NaBadge, NaSkeleton, NaQuantityStepper],
  template: `
    <div class="na-container page">
      <na-stepper [steps]="steps" [currentIndex]="3" />
      <h1>Baggage & extras</h1>
      <p class="page__sub na-text-muted">
        Add bags, meals and services to your trip — all prices come from the booking service and are
        confirmed again at review.
      </p>

      @if (reconciledNotice()) {
        <na-alert tone="warning" icon="⚠" title="Your extras were updated" [dismissible]="true" (dismissed)="reconciledNotice.set(false)">
          Availability or prices changed since your last visit, so your selection was adjusted to match
          the current catalog. Please review it below.
        </na-alert>
      }

      @if (quoteError()) {
        <na-alert tone="danger" icon="⚠" title="Prices could not be confirmed" [retryable]="true" (retry)="requestQuote()">
          The booking service rejected or could not price the current selection — try again, or adjust
          your selection below.
        </na-alert>
      }

      <div class="layout">
        <div class="main">
          @if (trip(); as t) {
            <section class="na-card trip" aria-labelledby="trip-h">
              <h2 id="trip-h" class="na-visually-hidden">Trip summary</h2>
              <div class="trip__route">
                <span class="trip__code">{{ t.originCode }}</span>
                <span class="trip__line" aria-hidden="true"></span>
                <span class="trip__plane" aria-hidden="true">✈</span>
                <span class="trip__line" aria-hidden="true"></span>
                <span class="trip__code">{{ t.destinationCode }}</span>
              </div>
              <p class="trip__meta na-text-small na-text-muted">
                {{ t.flightNumber }} · {{ t.date }} · {{ t.cabin }} ·
                {{ t.passengerCount }} traveller{{ t.passengerCount > 1 ? 's' : '' }}
              </p>
            </section>
          }

          @if (fareRules(); as rules) {
            <section class="na-card allowance" aria-labelledby="allow-h">
              <h2 id="allow-h">Included in your fare</h2>
              <ul class="allowance__list">
                <li>
                  <span class="allowance__icon" aria-hidden="true">🧳</span>
                  <span>{{ rules.checkedBaggagePieces }}× checked bag up to {{ rules.checkedBaggageWeightKg }} kg per passenger</span>
                </li>
                <li>
                  <span class="allowance__icon" aria-hidden="true">🎒</span>
                  <span>{{ rules.carryOnPieces }}× carry-on bag per passenger</span>
                </li>
                @if (rules.priorityBoarding) {
                  <li>
                    <span class="allowance__icon" aria-hidden="true">⚡</span>
                    <span>Priority boarding</span>
                  </li>
                }
                @if (rules.loungeAccess) {
                  <li>
                    <span class="allowance__icon" aria-hidden="true">🛋</span>
                    <span>Lounge access</span>
                  </li>
                }
              </ul>
            </section>
          }

          @if (loading()) {
            <na-skeleton [rows]="[1, 2, 3]" height="6rem" />
          } @else if (loadError()) {
            <na-alert tone="danger" icon="⚠" title="We couldn't load the extras catalog" [retryable]="true" (retry)="load()">
              The catalog is unavailable right now. Your current selection is preserved — please try again.
            </na-alert>
          } @else if (catalog().length === 0) {
            <section class="na-card empty">
              <p>No add-on services are available for this flight. You can simply continue to review.</p>
            </section>
          } @else {
            @for (cat of categories(); track cat) {
              <section [attr.aria-labelledby]="'cat-' + cat">
                <h2 class="cat__heading" [id]="'cat-' + cat">
                  <span aria-hidden="true">{{ categoryMeta(cat).icon }}</span> {{ categoryMeta(cat).title }}
                </h2>
                <ul class="cards" role="list">
                  @for (item of byCategory(cat); track item.id) {
                    <li class="na-card xcard" [class.xcard--selected]="quantityFor(item) > 0">
                      <div class="xcard__head">
                        <p class="xcard__name">
                          {{ item.name }}
                          @if (item.demonstration) {
                            <na-badge tone="warning">Demonstration — not real coverage</na-badge>
                          }
                        </p>
                        <p class="xcard__price">
                          <strong>{{ money(item.price) }}</strong>
                          <span class="na-text-small na-text-muted"> {{ unitLabel(item) }}</span>
                        </p>
                      </div>
                      @if (item.description) {
                        <p class="xcard__desc na-text-small na-text-muted">{{ item.description }}</p>
                      }
                      <p class="xcard__meta na-text-small na-text-muted">
                        @if (item.bagWeightKg !== null) { <span>Up to {{ item.bagWeightKg }} kg per bag · </span> }
                        @if (item.dietaryTags.length > 0) { <span>Dietary: {{ item.dietaryTags.join(', ') }} · </span>
                        }
                        @if (item.pricingUnit === 'PER_ITEM' && item.maxQuantity > 1) {
                          <span>max {{ item.maxQuantity }} {{ item.requiresPassenger ? 'per traveller' : 'per booking' }}</span>
                        }
                      </p>

                      <div class="xcard__controls">
                        @switch (item.pricingUnit) {
                          @case ('PER_ITEM') {
                            @if (item.requiresPassenger) {
                              @for (p of passengers(); track $index; let i = $index) {
                                <na-quantity-stepper
                                  [label]="item.name + ' for ' + (p.firstName || 'Passenger ' + (i + 1))"
                                  [value]="quantityOf(item, i)"
                                  [min]="0"
                                  [max]="item.maxQuantity"
                                  (valueChange)="setQuantity(item, i, $event)"
                                />
                              }
                            } @else {
                              <na-quantity-stepper
                                [label]="item.name"
                                [value]="quantityOf(item, null)"
                                [min]="0"
                                [max]="item.maxQuantity"
                                (valueChange)="setQuantity(item, null, $event)"
                              />
                            }
                          }
                          @case ('PER_PASSENGER') {
                            <ul class="pax-toggles" role="list">
                              @for (p of passengers(); track $index; let i = $index) {
                                <li>
                                  <button
                                    type="button"
                                    class="pax-toggle"
                                    [class.pax-toggle--on]="isSelected(item, i)"
                                    [attr.aria-pressed]="isSelected(item, i)"
                                    (click)="togglePassenger(item, i)"
                                  >
                                    <span>{{ p.firstName || 'Passenger ' + (i + 1) }}</span>
                                    <span class="pax-toggle__state">{{ isSelected(item, i) ? 'Added' : 'Add' }}</span>
                                  </button>
                                </li>
                              }
                            </ul>
                          }
                          @case ('PER_BOOKING') {
                            <button
                              type="button"
                              class="pax-toggle pax-toggle--booking"
                              [class.pax-toggle--on]="isSelected(item, null)"
                              [attr.aria-pressed]="isSelected(item, null)"
                              (click)="toggleBooking(item)"
                            >
                              <span>Whole booking</span>
                              <span class="pax-toggle__state">{{ isSelected(item, null) ? 'Added' : 'Add' }}</span>
                            </button>
                          }
                        }
                      </div>
                    </li>
                  }
                </ul>
              </section>
            }
          }
        </div>

        <aside class="na-card side" aria-label="Order summary" aria-live="polite">
          <h2>Order summary</h2>
          @if (breakdown(); as b) {
            <table class="side__table">
              <tbody>
                <tr><td>Base fare ({{ b.passengerCount }} traveller{{ b.passengerCount > 1 ? 's' : '' }})</td><td>{{ money(b.base) }}</td></tr>
                <tr><td>Taxes</td><td>{{ money(b.taxes) }}</td></tr>
                <tr><td>Fees</td><td>{{ money(b.fees) }}</td></tr>
                @for (line of extrasLines(); track line.key) {
                  <tr><td>{{ line.label }}</td><td>{{ money(line.total) }}</td></tr>
                }
                <tr class="side__total"><td>Total</td><td>{{ money(b.total + extrasTotal()) }}</td></tr>
              </tbody>
            </table>
            @if (quoteLoading()) {
              <p class="na-hint">Confirming prices with the booking service…</p>
            }
            <p class="na-hint">Seats are included at no charge. The exact total is confirmed at review.</p>
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
    h2 { font-size: var(--na-text-xl); }
    na-alert { display: block; margin-bottom: var(--na-space-4); }
    .layout { display: grid; grid-template-columns: 1fr 320px; gap: var(--na-space-5); align-items: start; }
    .main { display: grid; gap: var(--na-space-5); align-content: start; }

    .trip { padding: var(--na-space-5) var(--na-space-6); display: grid; gap: var(--na-space-2); justify-items: center; }
    .trip__route { display: flex; align-items: center; gap: var(--na-space-3); }
    .trip__code { font-family: var(--na-font-display); font-size: var(--na-text-2xl); font-weight: var(--na-font-bold); letter-spacing: 0.04em; }
    .trip__line { width: 42px; height: 1px; background: var(--na-border-strong); }
    .trip__plane { color: var(--na-ink-500); }
    .trip__meta { text-align: center; }

    .allowance { padding: var(--na-space-6); }
    .allowance h2 { margin-bottom: var(--na-space-3); }
    .allowance__list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--na-space-2); font-size: var(--na-text-sm); }
    .allowance__list li { display: flex; align-items: center; gap: var(--na-space-3); }
    .allowance__icon { width: 1.4rem; text-align: center; }

    .empty { padding: var(--na-space-6); color: var(--na-ink-700); }
    .cat__heading { display: flex; align-items: center; gap: var(--na-space-2); margin-bottom: var(--na-space-3); }
    .cards { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--na-space-3); }
    .xcard { padding: var(--na-space-4) var(--na-space-5); border: 1px solid var(--na-border); transition: border-color var(--na-motion-fast) var(--na-ease); }
    .xcard--selected { border-color: var(--na-blue-600); box-shadow: var(--na-focus-ring); }
    .xcard__head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--na-space-3); flex-wrap: wrap; }
    .xcard__name { font-weight: var(--na-font-semibold); display: flex; align-items: center; gap: var(--na-space-2); flex-wrap: wrap; }
    .xcard__price { white-space: nowrap; }
    .xcard__desc { margin-top: var(--na-space-1); }
    .xcard__meta { margin-top: var(--na-space-1); }
    .xcard__controls { margin-top: var(--na-space-3); display: grid; gap: var(--na-space-2); justify-items: start; }
    .pax-toggles { list-style: none; margin: 0; padding: 0; display: flex; gap: var(--na-space-2); flex-wrap: wrap; }
    .pax-toggle {
      display: inline-flex; align-items: center; gap: var(--na-space-3); min-height: 44px;
      border: 1px solid var(--na-border-strong); border-radius: var(--na-radius-md);
      background: var(--na-surface-sunken); color: var(--na-ink-900); padding: var(--na-space-1) var(--na-space-3);
      font-size: var(--na-text-sm);
    }
    .pax-toggle:hover { border-color: var(--na-navy-300); }
    .pax-toggle--on { border-color: var(--na-blue-600); background: var(--na-blue-100); }
    .pax-toggle__state { font-weight: var(--na-font-semibold); color: var(--na-blue-600); }

    .side { padding: var(--na-space-6); position: sticky; top: var(--na-space-4); }
    .side h2 { margin-bottom: var(--na-space-4); }
    .side__table { width: 100%; border-collapse: collapse; font-size: var(--na-text-sm); margin-bottom: var(--na-space-2); }
    .side__table td { padding: var(--na-space-1) 0; }
    .side__table td:last-child { text-align: right; font-weight: var(--na-font-medium); }
    .side__total td { border-top: 1px solid var(--na-border); padding-top: var(--na-space-2); font-size: var(--na-text-lg); font-weight: var(--na-font-bold); }
    .side__actions { display: grid; gap: var(--na-space-2); margin-top: var(--na-space-4); }

    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
      .side { position: static; order: -1; }
    }
  `,
})
export class ExtrasPage {
  private readonly router = inject(Router);
  private readonly draft = inject(BookingDraftService);
  private readonly extrasApi = inject(ExtrasCatalogService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly steps = BOOKING_STEPS;
  protected readonly passengers = this.draft.passengers;

  protected readonly catalog = signal<ExtraCatalogItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly reconciledNotice = signal(false);
  protected readonly selections = signal<ExtraSelection[]>([]);
  protected readonly quote = signal<ExtrasQuote | null>(null);
  protected readonly quoteLoading = signal(false);
  protected readonly quoteError = signal(false);

  /** Rich rules only when the API provides them — never fabricated. */
  protected readonly fareRules = computed(() => this.draft.fare()?.rules ?? null);

  /** Compact trip header built from the existing draft — no new data. */
  protected readonly trip = computed(() => {
    const d = this.draft.draft();
    if (!d?.outbound?.route || !d.fare) return null;
    return {
      originCode: d.outbound.route.origin.iataCode,
      destinationCode: d.outbound.route.destination.iataCode,
      flightNumber: d.outbound.flightNumber,
      date: new Intl.DateTimeFormat('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(d.outbound.departureTime)),
      cabin: this.label(d.fare.cabinClass),
      passengerCount: d.passengers.length,
    };
  });

  /** Categories actually present in the catalog data, in fixed display order. */
  protected readonly categories = computed(() =>
    CATEGORY_ORDER.filter((c) => this.catalog().some((item) => item.category === c)),
  );

  /** Server-consistent fare figures: fare components × passengers, as at review. */
  protected readonly breakdown = computed(() => {
    const d = this.draft.draft();
    if (!d) return null;
    const passengerCount = d.passengers.length;
    const base = d.fare.basePrice * passengerCount;
    const taxes = d.fare.taxAmount * passengerCount;
    const fees = d.fare.feeAmount * passengerCount;
    return { passengerCount, base, taxes, fees, total: base + taxes + fees };
  });

  /** Extras total: the server quote when available, otherwise the sum of server-priced lines. */
  protected readonly extrasTotal = computed(() => {
    const q = this.quote();
    if (q && !this.quoteError()) return q.extrasTotal;
    return this.selections().reduce((sum, s) => sum + s.service.price * s.quantity, 0);
  });

  /** Itemized extras lines for the summary (server-quoted names/prices when possible). */
  protected readonly extrasLines = computed(() => {
    const q = this.quote();
    if (q && !this.quoteError()) {
      return q.lines.map((l) => ({
        key: `${l.serviceId}:${l.passengerIndex ?? ''}`,
        label: `${l.name}${l.quantity > 1 ? ' ×' + l.quantity : ''}${this.paxLabel(l.passengerIndex)}`,
        total: l.totalPrice,
      }));
    }
    return this.selections().map((s) => ({
      key: `${s.service.id}:${s.passengerIndex ?? ''}`,
      label: `${s.service.name}${s.quantity > 1 ? ' ×' + s.quantity : ''}${this.paxLabel(s.passengerIndex)}`,
      total: s.service.price * s.quantity,
    }));
  });

  constructor() {
    const d = this.draft.draft();
    if (!d) {
      this.router.navigateByUrl('/search');
      return;
    }
    this.selections.set(d.extras);
    this.load();
  }

  protected load(): void {
    const d = this.draft.draft();
    if (!d) return;
    this.loading.set(true);
    this.loadError.set(false);
    this.extrasApi
      .catalog({ flightId: d.outbound.id, cabinClass: d.fare.cabinClass })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.catalog.set(items);
          this.loading.set(false);
          this.reconcile();
          this.requestQuote();
        },
        error: () => {
          this.loading.set(false);
          this.loadError.set(true);
        },
      });
  }

  /**
   * Re-check stored draft selections against the current catalog: drop
   * services that vanished, clamp quantities to catalog limits, refresh the
   * catalog item (current server price) and enforce association rules.
   */
  private reconcile(): void {
    const items = new Map(this.catalog().map((c) => [c.id, c]));
    const passengerCount = this.passengers().length;
    let changed = false;
    const kept: ExtraSelection[] = [];
    for (const sel of this.selections()) {
      const item = items.get(sel.service.id);
      if (!item) {
        changed = true;
        continue;
      }
      let quantity = Math.min(Math.max(1, sel.quantity), item.maxQuantity);
      if (item.pricingUnit !== 'PER_ITEM') quantity = 1;
      let passengerIndex = sel.passengerIndex;
      const needsPassenger = item.requiresPassenger || item.pricingUnit === 'PER_PASSENGER';
      if (item.pricingUnit === 'PER_BOOKING') passengerIndex = null;
      if (needsPassenger && (passengerIndex === null || passengerIndex >= passengerCount)) {
        changed = true;
        continue;
      }
      if (kept.some((k) => k.service.id === item.id && k.passengerIndex === passengerIndex)) {
        changed = true;
        continue;
      }
      if (quantity !== sel.quantity || passengerIndex !== sel.passengerIndex || item.price !== sel.service.price) {
        changed = true;
      }
      kept.push({ service: item, quantity, passengerIndex });
    }
    // Always store the fresh catalog items (server prices may have changed);
    // only notify when selections had to be dropped or adjusted.
    this.selections.set(kept);
    this.draft.setExtras(kept);
    if (changed) {
      this.reconciledNotice.set(true);
    }
  }

  protected byCategory(category: ExtraCategory): ExtraCatalogItem[] {
    return this.catalog().filter((item) => item.category === category);
  }

  protected categoryMeta(category: ExtraCategory) {
    return CATEGORY_META[category];
  }

  protected quantityOf(item: ExtraCatalogItem, passengerIndex: number | null): number {
    return (
      this.selections().find((s) => s.service.id === item.id && s.passengerIndex === passengerIndex)?.quantity ?? 0
    );
  }

  /** Total selected quantity of a service across passengers (drives selected styling). */
  protected quantityFor(item: ExtraCatalogItem): number {
    return this.selections()
      .filter((s) => s.service.id === item.id)
      .reduce((sum, s) => sum + s.quantity, 0);
  }

  protected isSelected(item: ExtraCatalogItem, passengerIndex: number | null): boolean {
    return this.quantityOf(item, passengerIndex) > 0;
  }

  protected setQuantity(item: ExtraCatalogItem, passengerIndex: number | null, quantity: number): void {
    this.updateSelections((list) => {
      const without = list.filter((s) => !(s.service.id === item.id && s.passengerIndex === passengerIndex));
      if (quantity <= 0) return without;
      const clamped = Math.min(quantity, item.maxQuantity);
      return [...without, { service: item, quantity: clamped, passengerIndex }];
    });
  }

  protected togglePassenger(item: ExtraCatalogItem, passengerIndex: number): void {
    this.setQuantity(item, passengerIndex, this.isSelected(item, passengerIndex) ? 0 : 1);
  }

  protected toggleBooking(item: ExtraCatalogItem): void {
    this.setQuantity(item, null, this.isSelected(item, null) ? 0 : 1);
  }

  /** Persist to the draft on every change so Back/Continue keep selections. */
  private updateSelections(fn: (list: ExtraSelection[]) => ExtraSelection[]): void {
    this.selections.update(fn);
    this.draft.setExtras(this.selections());
    this.requestQuote();
  }

  /** Live server quote for the current selection (read-only; never persists). */
  protected requestQuote(): void {
    const d = this.draft.draft();
    const selections = this.selections();
    if (!d) return;
    if (selections.length === 0) {
      this.quote.set(null);
      this.quoteError.set(false);
      return;
    }
    this.quoteLoading.set(true);
    this.quoteError.set(false);
    this.extrasApi
      .quote({
        flightId: d.outbound.id,
        cabinClass: d.fare.cabinClass,
        passengerCount: d.passengers.length,
        selections: selections.map((s) => ({
          serviceId: s.service.id,
          quantity: s.quantity,
          ...(s.passengerIndex !== null ? { passengerIndex: s.passengerIndex } : {}),
        })),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (quote) => {
          this.quote.set(quote);
          this.quoteLoading.set(false);
        },
        error: () => {
          this.quoteLoading.set(false);
          this.quoteError.set(true);
          this.quote.set(null);
        },
      });
  }

  protected unitLabel(item: ExtraCatalogItem): string {
    switch (item.pricingUnit) {
      case 'PER_ITEM':
        return item.category === 'BAGGAGE' ? 'per bag' : 'each';
      case 'PER_PASSENGER':
        return 'per traveller';
      case 'PER_BOOKING':
        return 'per booking';
    }
  }

  private paxLabel(passengerIndex: number | null): string {
    if (passengerIndex === null) return '';
    const p = this.passengers()[passengerIndex];
    return ` · ${p?.firstName || 'Passenger ' + (passengerIndex + 1)}`;
  }

  protected money(amount: number): string {
    const currency = this.draft.fare()?.currency ?? 'EUR';
    return formatMoney(amount, currency);
  }

  protected label(cabin: string): string {
    return cabin
      .split('_')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ');
  }

  protected continue(): void {
    this.draft.setExtras(this.selections());
    // Legacy per-passenger bag counters are superseded by real extras lines.
    this.draft.setBaggage(this.passengers().map(() => 0));
    this.router.navigateByUrl('/booking/review');
  }

  protected back(): void {
    this.router.navigateByUrl('/booking/seats');
  }
}
