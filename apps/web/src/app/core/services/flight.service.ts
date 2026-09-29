import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, delay, map, catchError } from 'rxjs';
import { FLIGHTS, AIRPORTS, ROUTES } from '../mock/mock-data';
import { API_CONFIG, type ApiConfig } from '../config/api-config';
import type { Flight, Airport } from '../models/domain.model';
import type { SearchCriteria, ResultFilters, ResultSort } from '../models/booking-flow.model';

@Injectable({ providedIn: 'root' })
export class FlightService {
  private readonly http = inject(HttpClient);
  private readonly config: ApiConfig = inject(API_CONFIG);

  searchAirports(query: string): Observable<Airport[]> {
    if (this.config.useRealApi) {
      return this.http.get<Airport[]>(`${this.config.baseUrl}/flights/airports/search`, {
        params: { q: query.trim() },
      });
    }
    const q = query.trim().toLowerCase();
    const results =
      q.length === 0
        ? AIRPORTS
        : AIRPORTS.filter(
            (a) =>
              a.iataCode.toLowerCase().includes(q) ||
              a.name.toLowerCase().includes(q) ||
              a.city.toLowerCase().includes(q) ||
              a.country.toLowerCase().includes(q),
          );
    return of(results).pipe(delay(150));
  }

  searchDestinations(originCode: string, query = ''): Observable<Airport[]> {
    if (this.config.useRealApi) {
      return this.http.get<Airport[]>(`${this.config.baseUrl}/flights/destinations`, {
        params: { from: originCode, q: query.trim() },
      });
    }
    const q = query.trim().toLowerCase();
    const destinations = ROUTES.filter(
      (r) => r.status === 'ACTIVE' && r.origin.iataCode === originCode.toUpperCase(),
    ).map((r) => r.destination);
    const results =
      q.length === 0
        ? destinations
        : destinations.filter(
            (a) =>
              a.iataCode.toLowerCase().includes(q) ||
              a.name.toLowerCase().includes(q) ||
              a.city.toLowerCase().includes(q) ||
              a.country.toLowerCase().includes(q),
          );
    return of(results).pipe(delay(150));
  }

  searchFlights(criteria: SearchCriteria): Observable<Flight[]> {
    if (this.config.useRealApi) {
      return this.http.get<Flight[]>(`${this.config.baseUrl}/flights/search/advanced`, {
        params: searchParams(criteria),
      });
    }
    const targetDate = new Date(criteria.departureDate);
    const matches = FLIGHTS.filter((f) => {
      const sameRoute =
        f.route.origin.iataCode === criteria.originCode &&
        f.route.destination.iataCode === criteria.destinationCode;
      const dep = new Date(f.departureTime);
      const sameDay =
        dep.getFullYear() === targetDate.getFullYear() &&
        dep.getMonth() === targetDate.getMonth() &&
        dep.getDate() === targetDate.getDate();
      const hasFare = f.fares.some(
        (fare) => fare.cabinClass === criteria.cabinClass && fare.availableCount > 0,
      );
      const bookable = f.status === 'SCHEDULED' || f.status === 'ACTIVE' || f.status === 'DELAYED';
      return sameRoute && sameDay && hasFare && bookable;
    });
    return of(matches).pipe(delay(400));
  }

  adjacentDateAvailability(
    criteria: SearchCriteria,
  ): Observable<{ date: string; minPrice: number | null }[]> {
    if (this.config.useRealApi) {
      return this.http.get<{ date: string; minPrice: number | null }[]>(
        `${this.config.baseUrl}/flights/adjacent`,
        {
          params: searchParams(criteria),
        },
      );
    }
    const base = new Date(criteria.departureDate);
    const days: { date: string; minPrice: number | null }[] = [];
    for (let offset = -3; offset <= 3; offset++) {
      const d = new Date(base);
      d.setDate(d.getDate() + offset);
      const dateStr = d.toISOString().slice(0, 10);
      const dayFlights = FLIGHTS.filter((f) => {
        const dep = new Date(f.departureTime);
        return (
          f.route.origin.iataCode === criteria.originCode &&
          f.route.destination.iataCode === criteria.destinationCode &&
          dep.toISOString().slice(0, 10) === dateStr &&
          f.status !== 'CANCELLED'
        );
      });
      const prices = dayFlights.flatMap((f) =>
        f.fares
          .filter((fare) => fare.cabinClass === criteria.cabinClass)
          .map((fare) => fare.basePrice + fare.taxAmount + fare.feeAmount),
      );
      days.push({ date: dateStr, minPrice: prices.length ? Math.min(...prices) : null });
    }
    return of(days).pipe(delay(200));
  }

  getFlight(id: string): Observable<Flight | undefined> {
    if (this.config.useRealApi) {
      return this.http.get<Flight>(`${this.config.baseUrl}/flights/${id}`).pipe(
        map((f) => f ?? undefined),
        catchError(() => of(undefined)),
      );
    }
    return of(FLIGHTS.find((f) => f.id === id)).pipe(delay(200));
  }

  flightStatusByNumber(flightNumber: string, date?: string): Observable<Flight[]> {
    if (this.config.useRealApi) {
      let params = new HttpParams().set('flightNumber', flightNumber.trim());
      if (date) params = params.set('date', date);
      return this.http.get<Flight[]>(`${this.config.baseUrl}/flights/status/by-number`, { params });
    }
    const n = flightNumber.trim().toUpperCase();
    return of(
      FLIGHTS.filter((f) => {
        const matchesNumber = f.flightNumber.toUpperCase().includes(n);
        if (!date) return matchesNumber;
        return new Date(f.departureTime).toISOString().slice(0, 10) === date;
      }),
    ).pipe(delay(300));
  }

  flightStatusByRoute(originCode: string, destinationCode: string): Observable<Flight[]> {
    if (this.config.useRealApi) {
      const params = new HttpParams()
        .set('origin', originCode.toUpperCase())
        .set('destination', destinationCode.toUpperCase());
      return this.http.get<Flight[]>(`${this.config.baseUrl}/flights/status/by-route`, { params });
    }
    return of(
      FLIGHTS.filter(
        (f) =>
          f.route.origin.iataCode === originCode.toUpperCase() &&
          f.route.destination.iataCode === destinationCode.toUpperCase(),
      ),
    ).pipe(delay(300));
  }

  adminFlights(): Observable<Flight[]> {
    return of(FLIGHTS).pipe(delay(250));
  }
}

/** Query-param contract shared by the search page and the API (FR-C04). */
function searchParams(criteria: SearchCriteria): HttpParams {
  let params = new HttpParams()
    .set('tripType', criteria.tripType)
    .set('origin', criteria.originCode)
    .set('destination', criteria.destinationCode)
    .set('depart', criteria.departureDate)
    .set('adults', criteria.passengers.adults)
    .set('children', criteria.passengers.children)
    .set('infants', criteria.passengers.infants)
    .set('cabin', criteria.cabinClass);
  if (criteria.returnDate) params = params.set('return', criteria.returnDate);
  if (criteria.promoCode) params = params.set('promo', criteria.promoCode);
  return params;
}

export function applyFilters(
  flights: Flight[],
  filters: ResultFilters,
  cabinClass: string,
): Flight[] {
  return flights.filter((f) => {
    const fare = f.fares.find((x) => x.cabinClass === cabinClass) ?? f.fares[0];
    const total = fare.basePrice + fare.taxAmount + fare.feeAmount;
    if (filters.maxPrice != null && total > filters.maxPrice) return false;
    if (filters.refundableOnly && !fare.rules.refundable) return false;
    if (filters.departureWindow) {
      const h = new Date(f.departureTime).getHours();
      const inWindow =
        filters.departureWindow === 'morning'
          ? h < 12
          : filters.departureWindow === 'afternoon'
            ? h >= 12 && h < 18
            : h >= 18;
      if (!inWindow) return false;
    }
    if (filters.stops === 'nonstop' && f.segments.length > 1) return false;
    return true;
  });
}

export function applySort(flights: Flight[], sort: ResultSort, cabinClass: string): Flight[] {
  const fareOf = (f: Flight) => f.fares.find((x) => x.cabinClass === cabinClass) ?? f.fares[0];
  const totalOf = (f: Flight) => {
    const fare = fareOf(f);
    return fare.basePrice + fare.taxAmount + fare.feeAmount;
  };
  const durationOf = (f: Flight) =>
    new Date(f.arrivalTime).getTime() - new Date(f.departureTime).getTime();
  const list = [...flights];
  switch (sort) {
    case 'price':
      return list.sort((a, b) => totalOf(a) - totalOf(b));
    case 'duration':
      return list.sort((a, b) => durationOf(a) - durationOf(b));
    case 'departure':
      return list.sort(
        (a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime(),
      );
    case 'recommended':
    default:
      return list.sort(
        (a, b) =>
          totalOf(a) * 0.7 + durationOf(a) / 60000 - (totalOf(b) * 0.7 + durationOf(b) / 60000),
      );
  }
}

export function flightDurationLabel(f: Flight): string {
  const mins = Math.round(
    (new Date(f.arrivalTime).getTime() - new Date(f.departureTime).getTime()) / 60000,
  );
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}
