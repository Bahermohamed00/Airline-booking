import type { Airport, Aircraft, Flight, FlightSegment, Route, Seat, Fare } from '@prisma/client';
export interface FareRuleResponse {
    refundable: boolean;
    changeAllowed: boolean;
    changeFee: number;
    cancellationFeePercent: number;
    checkedBaggagePieces: number;
    checkedBaggageWeightKg: number;
    carryOnPieces: number;
    seatSelectionFee: number;
    priorityBoarding: boolean;
    loungeAccess: boolean;
    description: string;
}
export declare function mapAirport(a: Airport): {
    id: string;
    iataCode: string;
    icaoCode: string | null;
    name: string;
    city: string;
    country: string;
    timezone: string;
    status: import("@prisma/client").$Enums.AirportStatus;
};
export declare function mapSeat(s: Seat): {
    id: string;
    aircraftId: string;
    seatNumber: string;
    cabinClass: import("@prisma/client").$Enums.CabinClass;
    seatRow: number | null;
    seatColumn: string | null;
    isExitRow: boolean;
    features: string | number | boolean | import(".prisma/client/runtime/library").JsonObject | import(".prisma/client/runtime/library").JsonArray;
};
export declare function mapAircraft(a: Aircraft & {
    seats?: Seat[];
}): {
    id: string;
    registration: string;
    model: string;
    capacity: number;
    status: import("@prisma/client").$Enums.AircraftStatus;
    seats: {
        id: string;
        aircraftId: string;
        seatNumber: string;
        cabinClass: import("@prisma/client").$Enums.CabinClass;
        seatRow: number | null;
        seatColumn: string | null;
        isExitRow: boolean;
        features: string | number | boolean | import(".prisma/client/runtime/library").JsonObject | import(".prisma/client/runtime/library").JsonArray;
    }[];
};
export declare function mapRoute(r: Route & {
    originAirport: Airport;
    destinationAirport: Airport;
}): {
    id: string;
    originAirportId: string;
    destinationAirportId: string;
    origin: {
        id: string;
        iataCode: string;
        icaoCode: string | null;
        name: string;
        city: string;
        country: string;
        timezone: string;
        status: import("@prisma/client").$Enums.AirportStatus;
    };
    destination: {
        id: string;
        iataCode: string;
        icaoCode: string | null;
        name: string;
        city: string;
        country: string;
        timezone: string;
        status: import("@prisma/client").$Enums.AirportStatus;
    };
    distanceKm: number | null;
    durationMinutes: number | null;
    status: import("@prisma/client").$Enums.RouteStatus;
};
export declare function mapSegment(s: FlightSegment & {
    originAirport: Airport;
    destinationAirport: Airport;
}): {
    id: string;
    flightId: string;
    segmentNumber: number;
    originAirportId: string;
    origin: {
        id: string;
        iataCode: string;
        icaoCode: string | null;
        name: string;
        city: string;
        country: string;
        timezone: string;
        status: import("@prisma/client").$Enums.AirportStatus;
    };
    destinationAirportId: string;
    destination: {
        id: string;
        iataCode: string;
        icaoCode: string | null;
        name: string;
        city: string;
        country: string;
        timezone: string;
        status: import("@prisma/client").$Enums.AirportStatus;
    };
    departureTime: string;
    arrivalTime: string;
};
export declare function mapFare(f: Fare): {
    id: string;
    flightId: string;
    cabinClass: import("@prisma/client").$Enums.CabinClass;
    basePrice: number;
    taxAmount: number;
    feeAmount: number;
    currency: string;
    availableCount: number;
    rules: FareRuleResponse;
};
type FlightWithRelations = Flight & {
    route: Route & {
        originAirport: Airport;
        destinationAirport: Airport;
    };
    aircraft: Aircraft & {
        seats?: Seat[];
    };
    segments: (FlightSegment & {
        originAirport: Airport;
        destinationAirport: Airport;
    })[];
    fares: Fare[];
};
export declare function mapFlight(f: FlightWithRelations): {
    id: string;
    flightNumber: string;
    routeId: string;
    route: {
        id: string;
        originAirportId: string;
        destinationAirportId: string;
        origin: {
            id: string;
            iataCode: string;
            icaoCode: string | null;
            name: string;
            city: string;
            country: string;
            timezone: string;
            status: import("@prisma/client").$Enums.AirportStatus;
        };
        destination: {
            id: string;
            iataCode: string;
            icaoCode: string | null;
            name: string;
            city: string;
            country: string;
            timezone: string;
            status: import("@prisma/client").$Enums.AirportStatus;
        };
        distanceKm: number | null;
        durationMinutes: number | null;
        status: import("@prisma/client").$Enums.RouteStatus;
    };
    aircraftId: string;
    aircraft: {
        id: string;
        registration: string;
        model: string;
        capacity: number;
        status: import("@prisma/client").$Enums.AircraftStatus;
        seats: {
            id: string;
            aircraftId: string;
            seatNumber: string;
            cabinClass: import("@prisma/client").$Enums.CabinClass;
            seatRow: number | null;
            seatColumn: string | null;
            isExitRow: boolean;
            features: string | number | boolean | import(".prisma/client/runtime/library").JsonObject | import(".prisma/client/runtime/library").JsonArray;
        }[];
    };
    departureTime: string;
    arrivalTime: string;
    status: import("@prisma/client").$Enums.FlightStatus;
    scheduleStatus: import("@prisma/client").$Enums.FlightScheduleStatus;
    segments: {
        id: string;
        flightId: string;
        segmentNumber: number;
        originAirportId: string;
        origin: {
            id: string;
            iataCode: string;
            icaoCode: string | null;
            name: string;
            city: string;
            country: string;
            timezone: string;
            status: import("@prisma/client").$Enums.AirportStatus;
        };
        destinationAirportId: string;
        destination: {
            id: string;
            iataCode: string;
            icaoCode: string | null;
            name: string;
            city: string;
            country: string;
            timezone: string;
            status: import("@prisma/client").$Enums.AirportStatus;
        };
        departureTime: string;
        arrivalTime: string;
    }[];
    fares: {
        id: string;
        flightId: string;
        cabinClass: import("@prisma/client").$Enums.CabinClass;
        basePrice: number;
        taxAmount: number;
        feeAmount: number;
        currency: string;
        availableCount: number;
        rules: FareRuleResponse;
    }[];
};
export {};
