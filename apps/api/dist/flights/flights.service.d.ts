import { PrismaService } from '../prisma/prisma.service.js';
import { mapFlight } from './flight-response.mapper.js';
import { SearchFlightsDto } from './dto/search-flights.dto.js';
type FlightResponse = ReturnType<typeof mapFlight>;
export declare class FlightsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    searchAirports(query?: string): Promise<{
        id: string;
        iataCode: string;
        icaoCode: string | null;
        name: string;
        city: string;
        country: string;
        timezone: string;
        status: import("@prisma/client").$Enums.AirportStatus;
    }[]>;
    searchFlights(dto: SearchFlightsDto): Promise<FlightResponse[]>;
    adjacentDates(dto: Pick<SearchFlightsDto, 'origin' | 'destination' | 'depart' | 'cabin'>): Promise<{
        date: string;
        minPrice: number | null;
    }[]>;
    getFlight(id: string): Promise<FlightResponse>;
    statusByNumber(flightNumber: string, date?: string): Promise<FlightResponse[]>;
    statusByRoute(originCode: string, destinationCode: string): Promise<FlightResponse[]>;
    private fareTotal;
    private applyFilters;
    private applySort;
}
export {};
