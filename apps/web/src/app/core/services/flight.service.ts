import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../config/api-config';
import type { Flight, Airport } from '../models/domain.model';
import { mapAirport, mapFlight, type ApiAirport, type ApiFlight } from '../models/flight-api.model';
import type { SearchCriteria, ResultFilters, ResultSort } from '../models/booking-flow.model';

const BOOKABLE_STATUSES = new Set(['SCHEDULED', 'ACTIVE', 'DELAYED']);

@Injectable({ providedIn: 'root' })
export class FlightService {
  private readonly http = inject(HttpClient);
  private readonly config: ApiConfig = inject(API_CONFIG);

  /** All airports (public endpoint), IATA-sorted; the client filters ACTIVE ones. */
  listAirports(): Observable<Airport[]> {
    return this.http.get<ApiAirport[]>(`${this.config.baseUrl}/airports`).pipe(
      map((list) =>
        list
          .map(mapAirport)
          .filter((a) => a.status === 'ACTIVE')
          .sort((a, b) => a.iataCode.localeCompare(b.iataCode)),
      ),
    );
  }

  searchAirports(query: string): Observable<Airport[]> {
    const q = query.trim().toLowerCase();
    return this.listAirports().pipe(
      map((airports) =>
        q.length === 0
          ? airports
          : airports.filter(
              (a) =>
                a.iataCode.toLowerCase().includes(q) ||
                a.name.toLowerCase().includes(q) ||
                a.city.toLowerCase().includes(q) ||
                a.country.toLowerCase().includes(q),
            ),
      ),
    );
  }

  /** Real search: origin/destination + departure date via the API's operatingDate semantics. */
  searchFlights(criteria: SearchCriteria): Observable<Flight[]> {
    return this.http
      .get<ApiFlight[]>(`${this.config.baseUrl}/flights`, {
        params: {
          origin: criteria.originCode,
          destination: criteria.destinationCode,
          date: criteria.departureDate,
        },
      })
      .pipe(
        map((flights) =>
          flights
            .map(mapFlight)
            .filter(
              (f) =>
                BOOKABLE_STATUSES.has(f.status) &&
                f.fares.some(
                  (fare) => fare.cabinClass === criteria.cabinClass && fare.availableCount > 0,
                ),
            ),
        ),
      );
  }

  /** ±3 day price calendar from a single from/to range query (no mock slicing). */
  adjacentDateAvailability(
    criteria: SearchCriteria,
  ): Observable<{ date: string; minPrice: number | null }[]> {
    const base = new Date(`${criteria.departureDate}T00:00:00Z`);
    const dates: string[] = [];
    for (let offset = -3; offset <= 3; offset++) {
      dates.push(new Date(base.getTime() + offset * 86_400_000).toISOString().slice(0, 10));
    }
    return this.http
      .get<ApiFlight[]>(`${this.config.baseUrl}/flights`, {
        params: {
          origin: criteria.originCode,
          destination: criteria.destinationCode,
          from: dates[0]!,
          to: dates[dates.length - 1]!,
        },
      })
      .pipe(
        map((flights) => {
          const mapped = flights.map(mapFlight);
          return dates.map((date) => {
            const prices = mapped
              .filter(
                (f) =>
                  (f.operatingDate ?? f.departureTime.slice(0, 10)) === date &&
                  f.status !== 'CANCELLED',
              )
              .flatMap((f) =>
                f.fares
                  .filter((fare) => fare.cabinClass === criteria.cabinClass)
                  .map((fare) => fare.basePrice + fare.taxAmount + fare.feeAmount),
              );
            return { date, minPrice: prices.length ? Math.min(...prices) : null };
          });
        }),
      );
  }

  getFlight(id: string): Observable<Flight | undefined> {
    return this.http.get<ApiFlight>(`${this.config.baseUrl}/flights/${id}`).pipe(
      map(mapFlight),
      catchError(() => of(undefined)),
    );
  }

  flightStatusByNumber(flightNumber: string, date?: string): Observable<Flight[]> {
    const n = flightNumber.trim().toUpperCase();
    return this.http
      .get<ApiFlight[]>(`${this.config.baseUrl}/flights`, { params: date ? { date } : {} })
      .pipe(
        map((flights) =>
          flights.map(mapFlight).filter((f) => f.flightNumber.toUpperCase().includes(n)),
        ),
      );
  }

  flightStatusByRoute(originCode: string, destinationCode: string): Observable<Flight[]> {
    return this.http
      .get<ApiFlight[]>(`${this.config.baseUrl}/flights`, {
        params: { origin: originCode.toUpperCase(), destination: destinationCode.toUpperCase() },
      })
      .pipe(map((flights) => flights.map(mapFlight)));
  }

  adminFlights(): Observable<Flight[]> {
    return this.http
      .get<ApiFlight[]>(`${this.config.baseUrl}/flights`)
      .pipe(map((flights) => flights.map(mapFlight)));
  }
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
    if (filters.refundableOnly && !fare.rules?.refundable) return false;
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
