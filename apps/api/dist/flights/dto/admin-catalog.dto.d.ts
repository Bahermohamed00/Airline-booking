import { CabinClassDto } from './search-flights.dto.js';
export declare class CreateAirportDto {
    iataCode: string;
    icaoCode?: string;
    name: string;
    city: string;
    country: string;
    timezone: string;
}
export declare class UpdateAirportDto {
    name?: string;
    city?: string;
    country?: string;
    timezone?: string;
    status?: 'ACTIVE' | 'INACTIVE';
}
export declare class CreateRouteDto {
    originAirportId: string;
    destinationAirportId: string;
    distanceKm?: number;
    durationMinutes?: number;
}
export declare class UpdateRouteDto {
    distanceKm?: number;
    durationMinutes?: number;
    status?: 'ACTIVE' | 'INACTIVE';
}
export declare class CreateAircraftDto {
    registration: string;
    model: string;
    capacity: number;
}
export declare class UpdateAircraftDto {
    model?: string;
    capacity?: number;
    status?: 'ACTIVE' | 'MAINTENANCE' | 'RETIRED';
}
export declare class CreateSegmentDto {
    segmentNumber: number;
    originAirportId: string;
    destinationAirportId: string;
    departureTime: string;
    arrivalTime: string;
}
export declare class CreateFareDto {
    cabinClass: CabinClassDto;
    basePrice: number;
    taxAmount?: number;
    feeAmount?: number;
    currency: string;
    availableCount: number;
}
export declare class UpdateFareDto {
    basePrice?: number;
    taxAmount?: number;
    feeAmount?: number;
    availableCount?: number;
}
export declare class CreateFlightDto {
    flightNumber: string;
    routeId: string;
    aircraftId: string;
    departureTime: string;
    arrivalTime: string;
    segments?: CreateSegmentDto[];
    fares?: CreateFareDto[];
}
export declare class UpdateFlightDto {
    departureTime?: string;
    arrivalTime?: string;
    aircraftId?: string;
    status?: 'SCHEDULED' | 'ACTIVE' | 'DELAYED' | 'CANCELLED' | 'COMPLETED';
}
