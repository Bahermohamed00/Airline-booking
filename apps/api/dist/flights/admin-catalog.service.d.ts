import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateAirportDto, UpdateAirportDto, CreateRouteDto, UpdateRouteDto, CreateAircraftDto, UpdateAircraftDto, CreateFlightDto, UpdateFlightDto, CreateFareDto, UpdateFareDto, CreateSegmentDto } from './dto/admin-catalog.dto.js';
export declare class AdminCatalogService {
    private readonly prisma;
    private readonly audit;
    constructor(prisma: PrismaService, audit: AuditService);
    listAirports(): Promise<{
        id: string;
        iataCode: string;
        icaoCode: string | null;
        name: string;
        city: string;
        country: string;
        timezone: string;
        status: import("@prisma/client").$Enums.AirportStatus;
    }[]>;
    createAirport(dto: CreateAirportDto, actorId: string): Promise<{
        id: string;
        iataCode: string;
        icaoCode: string | null;
        name: string;
        city: string;
        country: string;
        timezone: string;
        status: import("@prisma/client").$Enums.AirportStatus;
    }>;
    updateAirport(id: string, dto: UpdateAirportDto, actorId: string): Promise<{
        id: string;
        iataCode: string;
        icaoCode: string | null;
        name: string;
        city: string;
        country: string;
        timezone: string;
        status: import("@prisma/client").$Enums.AirportStatus;
    }>;
    deactivateAirport(id: string, actorId: string): Promise<{
        id: string;
        iataCode: string;
        icaoCode: string | null;
        name: string;
        city: string;
        country: string;
        timezone: string;
        status: import("@prisma/client").$Enums.AirportStatus;
    }>;
    listRoutes(): Promise<{
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
    createRoute(dto: CreateRouteDto, actorId: string): Promise<{
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
    updateRoute(id: string, dto: UpdateRouteDto, actorId: string): Promise<{
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
    listAircraft(): Promise<{
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
    createAircraft(dto: CreateAircraftDto, actorId: string): Promise<{
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
    updateAircraft(id: string, dto: UpdateAircraftDto, actorId: string): Promise<{
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
    private generateSeats;
    listFlights(): Promise<{
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
    createFlight(dto: CreateFlightDto, actorId: string): Promise<{
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
    updateFlight(id: string, dto: UpdateFlightDto, actorId: string): Promise<{
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
    addSegment(flightId: string, dto: CreateSegmentDto, actorId: string): Promise<{
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
    addFare(flightId: string, dto: CreateFareDto, actorId: string): Promise<{
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
    updateFare(id: string, dto: UpdateFareDto, actorId: string): Promise<{
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
    deleteFare(id: string, actorId: string): Promise<void>;
    private getFlightById;
    private mustAirport;
    private logAudit;
}
