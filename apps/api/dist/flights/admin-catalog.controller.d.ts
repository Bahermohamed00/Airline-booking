import { AdminCatalogService } from './admin-catalog.service.js';
import { type AuthUser } from '../auth/decorators/current-user.decorator.js';
import { CreateAirportDto, UpdateAirportDto, CreateRouteDto, UpdateRouteDto, CreateAircraftDto, UpdateAircraftDto, CreateFlightDto, UpdateFlightDto, CreateFareDto, UpdateFareDto, CreateSegmentDto } from './dto/admin-catalog.dto.js';
export declare class AdminCatalogController {
    private readonly catalog;
    constructor(catalog: AdminCatalogService);
    airports(): Promise<{
        id: string;
        iataCode: string;
        icaoCode: string | null;
        name: string;
        city: string;
        country: string;
        timezone: string;
        status: import("@prisma/client").$Enums.AirportStatus;
    }[]>;
    createAirport(dto: CreateAirportDto, user: AuthUser): Promise<{
        id: string;
        iataCode: string;
        icaoCode: string | null;
        name: string;
        city: string;
        country: string;
        timezone: string;
        status: import("@prisma/client").$Enums.AirportStatus;
    }>;
    updateAirport(id: string, dto: UpdateAirportDto, user: AuthUser): Promise<{
        id: string;
        iataCode: string;
        icaoCode: string | null;
        name: string;
        city: string;
        country: string;
        timezone: string;
        status: import("@prisma/client").$Enums.AirportStatus;
    }>;
    deactivateAirport(id: string, user: AuthUser): Promise<{
        id: string;
        iataCode: string;
        icaoCode: string | null;
        name: string;
        city: string;
        country: string;
        timezone: string;
        status: import("@prisma/client").$Enums.AirportStatus;
    }>;
    routes(): Promise<{
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
    }[]>;
    createRoute(dto: CreateRouteDto, user: AuthUser): Promise<{
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
    }>;
    updateRoute(id: string, dto: UpdateRouteDto, user: AuthUser): Promise<{
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
    }>;
    aircraft(): Promise<{
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
    }[]>;
    createAircraft(dto: CreateAircraftDto, user: AuthUser): Promise<{
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
    }>;
    updateAircraft(id: string, dto: UpdateAircraftDto, user: AuthUser): Promise<{
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
    }>;
    flights(): Promise<{
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
            rules: import("./flight-response.mapper.js").FareRuleResponse;
        }[];
    }[]>;
    createFlight(dto: CreateFlightDto, user: AuthUser): Promise<{
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
            rules: import("./flight-response.mapper.js").FareRuleResponse;
        }[];
    }>;
    updateFlight(id: string, dto: UpdateFlightDto, user: AuthUser): Promise<{
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
            rules: import("./flight-response.mapper.js").FareRuleResponse;
        }[];
    }>;
    addSegment(id: string, dto: CreateSegmentDto, user: AuthUser): Promise<{
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
            rules: import("./flight-response.mapper.js").FareRuleResponse;
        }[];
    }>;
    addFare(id: string, dto: CreateFareDto, user: AuthUser): Promise<{
        id: string;
        flightId: string;
        cabinClass: import("@prisma/client").$Enums.CabinClass;
        basePrice: number;
        taxAmount: number;
        feeAmount: number;
        currency: string;
        availableCount: number;
        rules: import("./flight-response.mapper.js").FareRuleResponse;
    }>;
    updateFare(id: string, dto: UpdateFareDto, user: AuthUser): Promise<{
        id: string;
        flightId: string;
        cabinClass: import("@prisma/client").$Enums.CabinClass;
        basePrice: number;
        taxAmount: number;
        feeAmount: number;
        currency: string;
        availableCount: number;
        rules: import("./flight-response.mapper.js").FareRuleResponse;
    }>;
    deleteFare(id: string, user: AuthUser): Promise<void>;
}
