import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FlightService } from '../../core/services/flight.service';
import type { Airport } from '../../core/models/domain.model';
import { daysFromNow, toDateInput } from './date-input';

@Component({
  selector: 'na-search-card',
  template: `
    <div class="card" role="search" aria-label="Flight search">
      <div class="card__tabs" role="group" aria-label="Trip type">
        <button
          type="button"
          class="tab"
          [class.tab--active]="tripType() === 'ROUND_TRIP'"
          [attr.aria-pressed]="tripType() === 'ROUND_TRIP'"
          (click)="tripType.set('ROUND_TRIP')"
        >
          Round trip
        </button>
        <button
          type="button"
          class="tab"
          [class.tab--active]="tripType() === 'ONE_WAY'"
          [attr.aria-pressed]="tripType() === 'ONE_WAY'"
          (click)="tripType.set('ONE_WAY')"
        >
          One way
        </button>
      </div>

      <form
        class="card__grid"
        [class.card__grid--oneway]="tripType() === 'ONE_WAY'"
        (submit)="submit($event)"
      >
        <div class="field">
          <label class="field__label" for="hs-from">From</label>
          <select
            id="hs-from"
            class="field__control"
            [value]="origin()"
            [disabled]="airportsLoading() || airportsError()"
            (change)="origin.set($any($event.target).value)"
          >
            <option value="" disabled>{{ airportsLoading() ? 'Loading airports…' : 'Select origin' }}</option>
            @for (a of airports(); track a.iataCode) {
              <option [value]="a.iataCode">{{ a.city }} ({{ a.iataCode }})</option>
            }
          </select>
        </div>

        <button
          type="button"
          class="card__swap"
          aria-label="Swap origin and destination"
          (click)="swap()"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>

        <div class="field">
          <label class="field__label" for="hs-to">To</label>
          <select
            id="hs-to"
            class="field__control"
            [value]="destination()"
            [disabled]="airportsLoading() || airportsError()"
            (change)="destination.set($any($event.target).value)"
          >
            <option value="" disabled>{{ airportsLoading() ? 'Loading airports…' : 'Select destination' }}</option>
            @for (a of airports(); track a.iataCode) {
              <option [value]="a.iataCode">{{ a.city }} ({{ a.iataCode }})</option>
            }
          </select>
        </div>

        <div class="field">
          <label class="field__label" for="hs-depart">Departure</label>
          <input
            id="hs-depart"
            class="field__control"
            type="date"
            [min]="minDate"
            [value]="departure()"
            (change)="onDepartureChange($any($event.target).value)"
          />
        </div>

        @if (tripType() === 'ROUND_TRIP') {
          <div class="field">
            <label class="field__label" for="hs-return">Return</label>
            <input
              id="hs-return"
              class="field__control"
              type="date"
              [min]="departure()"
              [value]="returnDate()"
              (change)="returnDate.set($any($event.target).value)"
            />
          </div>
        }

        <div class="field">
          <label class="field__label" for="hs-pax">Passengers</label>
          <select
            id="hs-pax"
            class="field__control"
            [value]="passengers()"
            (change)="passengers.set(+$any($event.target).value)"
          >
            @for (n of passengerOptions; track n) {
              <option [value]="n">{{ n }} {{ n === 1 ? 'passenger' : 'passengers' }}</option>
            }
          </select>
        </div>

        <button type="submit" class="card__submit">
          Search flights
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </form>

      @if (airportsError()) {
        <p class="card__error" role="alert">
          We couldn't load the airport list.
          <button type="button" class="card__retry" (click)="loadAirports()">Try again</button>
        </p>
      } @else if (!airportsLoading() && airports().length === 0) {
        <p class="card__error" role="status">
          No airports are available right now.
          <button type="button" class="card__retry" (click)="loadAirports()">Try again</button>
        </p>
      }

      @if (error()) {
        <p class="card__error" role="alert">{{ error() }}</p>
      }
    </div>
  `,
  styles: `
    .card {
      background: var(--h-glass);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      border: 1px solid var(--h-line);
      border-radius: 20px;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
      padding: var(--na-space-6);
    }
    .card__tabs {
      display: inline-flex; gap: var(--na-space-1); padding: 4px;
      background: var(--h-field); border-radius: var(--na-radius-full);
      margin-bottom: var(--na-space-5);
    }
    .tab {
      border: none; background: transparent; color: var(--h-cream-muted);
      font-size: var(--na-text-sm); font-weight: var(--na-font-medium);
      padding: 0.45rem 1.1rem; border-radius: var(--na-radius-full);
      transition: background var(--na-motion-fast) var(--na-ease), color var(--na-motion-fast) var(--na-ease);
    }
    .tab:hover { color: var(--h-cream); }
    .tab--active { background: var(--h-cream); color: var(--h-brown-900); font-weight: var(--na-font-semibold); }
    .card__grid {
      display: grid; gap: var(--na-space-4);
      grid-template-columns: 1fr auto 1fr 1fr 1fr 1fr auto;
      align-items: end;
    }
    .card__grid--oneway { grid-template-columns: 1fr auto 1fr 1fr 1fr auto; }
    .field { display: flex; flex-direction: column; gap: var(--na-space-1); min-width: 0; }
    .field__label {
      color: var(--h-cream-muted); font-size: var(--na-text-xs);
      font-weight: var(--na-font-semibold); letter-spacing: 0.12em; text-transform: uppercase;
    }
    .field__control {
      width: 100%; min-height: 52px;
      background: var(--h-field); color: var(--h-cream);
      border: 1px solid var(--h-onphoto-line); border-radius: var(--na-radius-md);
      padding: 0.7rem 0.85rem; font-size: var(--na-text-sm);
      transition: border-color var(--na-motion-fast) var(--na-ease), background var(--na-motion-fast) var(--na-ease);
      color-scheme: dark;
    }
    .field__control:hover { border-color: var(--h-onphoto-line-strong); }
    .field__control:focus-visible { border-color: var(--h-cream); background: var(--h-field-focus); }
    .card__swap {
      width: 52px; height: 52px; flex: none;
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--h-field); color: var(--h-cream-soft);
      border: 1px solid var(--h-onphoto-line); border-radius: var(--na-radius-md);
      transition: color var(--na-motion-fast) var(--na-ease), border-color var(--na-motion-fast) var(--na-ease), transform var(--na-motion-fast) var(--na-ease);
    }
    .card__swap svg { width: 20px; height: 20px; }
    .card__swap:hover { color: var(--h-cream); border-color: var(--h-onphoto-line-strong); transform: rotate(180deg); }
    .card__submit {
      display: inline-flex; align-items: center; justify-content: center; gap: var(--na-space-2);
      min-height: 52px; padding: 0.7rem 1.6rem; white-space: nowrap;
      background: var(--h-cream); color: var(--h-brown-900); border: none; border-radius: var(--na-radius-md);
      font-weight: var(--na-font-semibold); font-size: var(--na-text-base);
      transition: background var(--na-motion-fast) var(--na-ease), transform var(--na-motion-fast) var(--na-ease);
    }
    .card__submit svg { width: 18px; height: 18px; }
    .card__submit:hover { background: #ffffff; transform: translateY(-1px); }
    .card__error {
      margin-top: var(--na-space-4); color: var(--h-cream); font-size: var(--na-text-sm);
      background: var(--h-brown-700); border: 1px solid var(--h-onphoto-line-strong);
      border-radius: var(--na-radius-md); padding: var(--na-space-3) var(--na-space-4);
    }
    .card__retry {
      background: none; border: 1px solid currentColor; border-radius: var(--na-radius-sm);
      color: inherit; font-weight: var(--na-font-semibold); font-size: inherit;
      padding: 0.15rem 0.6rem; margin-left: var(--na-space-2);
    }
    .card__retry:hover { background: rgba(255, 255, 255, 0.12); }
    @media (max-width: 1100px) {
      .card__grid, .card__grid--oneway { grid-template-columns: 1fr auto 1fr 1fr 1fr; }
      .card__submit { grid-column: 1 / -1; }
    }
    @media (max-width: 720px) {
      .card { padding: var(--na-space-4); }
      .card__grid, .card__grid--oneway { grid-template-columns: 1fr; }
      .card__swap { transform: rotate(90deg); justify-self: center; }
      .card__swap:hover { transform: rotate(270deg); }
    }
  `,
})
export class SearchCard {
  private readonly router = inject(Router);
  private readonly flightsApi = inject(FlightService);

  protected readonly airports = signal<Airport[]>([]);
  protected readonly airportsLoading = signal(true);
  protected readonly airportsError = signal(false);
  protected readonly passengerOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  protected readonly minDate = toDateInput(new Date());

  protected readonly tripType = signal<'ONE_WAY' | 'ROUND_TRIP'>('ROUND_TRIP');
  protected readonly origin = signal('FRA');
  protected readonly destination = signal('');
  protected readonly departure = signal(daysFromNow(1));
  protected readonly returnDate = signal(daysFromNow(8));
  protected readonly passengers = signal(1);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.loadAirports();
  }

  protected loadAirports(): void {
    this.airportsLoading.set(true);
    this.airportsError.set(false);
    this.flightsApi.listAirports().subscribe({
      next: (airports) => {
        this.airports.set(airports);
        this.airportsLoading.set(false);
      },
      error: () => {
        this.airports.set([]);
        this.airportsLoading.set(false);
        this.airportsError.set(true);
      },
    });
  }

  protected swap(): void {
    const from = this.origin();
    this.origin.set(this.destination());
    this.destination.set(from);
  }

  protected onDepartureChange(value: string): void {
    this.departure.set(value);
    if (value && this.returnDate() < value) {
      this.returnDate.set(value);
    }
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const origin = this.origin();
    const destination = this.destination();
    if (!origin || !destination) {
      this.error.set('Please choose an origin and a destination airport.');
      return;
    }
    if (origin === destination) {
      this.error.set('Origin and destination must be different.');
      return;
    }
    if (!this.departure()) {
      this.error.set('Please pick a departure date.');
      return;
    }
    this.error.set(null);

    this.router.navigate(['/results'], {
      queryParams: {
        tripType: this.tripType(),
        origin,
        destination,
        depart: this.departure(),
        return: this.tripType() === 'ROUND_TRIP' ? this.returnDate() : undefined,
        adults: this.passengers(),
        children: 0,
        infants: 0,
        cabin: 'ECONOMY',
      },
    });
  }
}
