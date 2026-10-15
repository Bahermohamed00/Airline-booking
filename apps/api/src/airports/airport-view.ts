import { Airport } from '@prisma/client';

export type AirportView = Omit<Airport, 'latitude' | 'longitude'> & {
  latitude: number | null;
  longitude: number | null;
};

/** Serializes Prisma Decimal coordinates to plain numbers for API responses. */
export function toAirportView(airport: Airport): AirportView {
  return {
    ...airport,
    latitude: airport.latitude === null ? null : Number(airport.latitude),
    longitude: airport.longitude === null ? null : Number(airport.longitude),
  };
}
