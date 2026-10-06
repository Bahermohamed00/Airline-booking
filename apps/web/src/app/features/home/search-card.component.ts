import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FlightService } from '../../core/services/flight.service';
import type { Airport } from '../../core/models/domain.model';
import { daysFromNow, toDateInput } from './date-input';

@Component({
  selector: 'na-search-card',
  templateUrl: './search-card.component.html',
  styleUrl: './search-card.component.css',
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
