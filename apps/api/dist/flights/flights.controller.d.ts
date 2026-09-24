import { FlightsService } from './flights.service.js';
import { SearchFlightsDto, AirportQueryDto } from './dto/search-flights.dto.js';
import { StatusByNumberDto, StatusByRouteDto } from './dto/flight-status.dto.js';
export declare class FlightsController {
    private readonly flights;
    constructor(flights: FlightsService);
    airports(query: AirportQueryDto): Promise<{
        id: string;
        iataCode: string;
        icaoCode: string | null;
        name: string;
        city: string;
        country: string;
        timezone: string;
        status: import("@prisma/client").$Enums.AirportStatus;
    }[]>;
    search(dto: SearchFlightsDto): Promise<{
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
    adjacent(dto: SearchFlightsDto): Promise<{
        date: string;
        minPrice: number | null;
    }[]>;
    statusByNumber(dto: StatusByNumberDto): Promise<{
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
    statusByRoute(dto: StatusByRouteDto): Promise<{
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
    getFlight(id: string): Promise<{
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
}
