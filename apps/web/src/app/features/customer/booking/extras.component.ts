import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BookingDraftService } from '../../../core/services/booking-draft.service';
import { formatMoney } from '../../../core/services/pricing.service';
import { NaStepper } from '../../../shared/ui/stepper.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaQuantityStepper } from '../../../shared/ui/quantity-stepper.component';
import { BOOKING_STEPS } from './passengers.component';

@Component({
  selector: 'na-extras-page',
  imports: [NaStepper, NaButton, NaAlert, NaQuantityStepper],
  template: `
    <div class="na-container page">
      <na-stepper [steps]="steps" [currentIndex]="3" />
      <h1>Baggage & extras</h1>
      <p class="page__sub na-text-muted">Your fare allowance is shown below — paid add-ons are on the way.</p>

      <div class="layout">
        <div class="main">
          <na-alert tone="info" icon="ℹ" title="Ancillary services are not yet available">
            Extra bags, meals and other add-on services can't be added to a booking yet, and nothing on this
            page is included in your booking total. You can simply continue to review.
          </na-alert>

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
            <p class="na-text-muted na-text-small">Additional bags beyond your allowance will be available for purchase soon.</p>
            <fieldset class="bag-fieldset" disabled>
              <ul class="bag-rows">
                @for (p of passengers(); track $index; let i = $index) {
                  <li>
                    <na-quantity-stepper
                      [label]="'Extra bags for ' + (p.firstName || 'Passenger ' + (i + 1))"
                      [value]="0"
                      [min]="0"
                      [max]="3"
                    />
                  </li>
                }
              </ul>
            </fieldset>
          </section>
        </div>

        <aside class="na-card side" aria-label="Order summary" aria-live="polite">
          <h2>Order summary</h2>
          @if (breakdown(); as b) {
            <table class="side__table">
              <tbody>
                <tr><td>Base fare ({{ b.passengerCount }} traveller{{ b.passengerCount > 1 ? 's' : '' }})</td><td>{{ money(b.base) }}</td></tr>
                <tr><td>Taxes</td><td>{{ money(b.taxes) }}</td></tr>
                <tr><td>Fees</td><td>{{ money(b.fees) }}</td></tr>
                <tr class="side__total"><td>Total</td><td>{{ money(b.total) }}</td></tr>
              </tbody>
            </table>
            <p class="na-hint">Seats are included at no charge; no add-ons are part of this total.</p>
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
    na-alert { display: block; }
    .layout { display: grid; grid-template-columns: 1fr 320px; gap: var(--na-space-5); align-items: start; }
    .main { display: grid; gap: var(--na-space-5); align-content: start; }
    .panel, .allowance { padding: var(--na-space-6); }
    .allowance ul { margin: 0; padding-left: var(--na-space-5); display: grid; gap: var(--na-space-1); font-size: var(--na-text-sm); }
    .bag-fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
    .bag-rows { list-style: none; margin: var(--na-space-3) 0 0; padding: 0; display: grid; gap: var(--na-space-3); }
    .side { padding: var(--na-space-6); position: sticky; top: var(--na-space-4); }
    .side h2 { font-size: var(--na-text-xl); margin-bottom: var(--na-space-4); }
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

  protected readonly steps = BOOKING_STEPS;
  protected readonly passengers = this.draft.passengers;

  /** Rich rules only when the API provides them — never fabricated. */
  protected readonly fareRules = computed(() => this.draft.fare()?.rules ?? null);

  /** Server-consistent figures: fare price components × passenger count, nothing else. */
  protected readonly breakdown = computed(() => {
    const d = this.draft.draft();
    if (!d) return null;
    const passengerCount = d.passengers.length;
    const base = d.fare.basePrice * passengerCount;
    const taxes = d.fare.taxAmount * passengerCount;
    const fees = d.fare.feeAmount * passengerCount;
    return { passengerCount, base, taxes, fees, total: base + taxes + fees };
  });

  constructor() {
    if (!this.draft.draft()) {
      this.router.navigateByUrl('/search');
    }
  }

  protected money(amount: number): string {
    const currency = this.draft.fare()?.currency ?? 'EUR';
    return formatMoney(amount, currency);
  }

  protected continue(): void {
    // No extras backend exists — make sure nothing extras-related leaks downstream.
    this.draft.setExtras([]);
    this.draft.setBaggage(this.passengers().map(() => 0));
    this.router.navigateByUrl('/booking/review');
  }

  protected back(): void {
    this.router.navigateByUrl('/booking/seats');
  }
}
