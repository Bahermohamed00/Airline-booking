export declare enum TripType {
    ONE_WAY = "ONE_WAY",
    ROUND_TRIP = "ROUND_TRIP",
    MULTI_CITY = "MULTI_CITY"
}
export declare enum CabinClassDto {
    ECONOMY = "ECONOMY",
    PREMIUM_ECONOMY = "PREMIUM_ECONOMY",
    BUSINESS = "BUSINESS",
    FIRST = "FIRST"
}
export declare enum ResultSortDto {
    RECOMMENDED = "recommended",
    PRICE = "price",
    DURATION = "duration",
    DEPARTURE = "departure"
}
export declare class SearchFlightsDto {
    tripType: TripType;
    origin: string;
    destination: string;
    depart: string;
    return?: string;
    adults: number;
    children: number;
    infants: number;
    cabin: CabinClassDto;
    promo?: string;
    maxPrice?: number;
    departureWindow?: 'morning' | 'afternoon' | 'evening';
    refundableOnly?: string;
    stops?: 'any' | 'nonstop';
    sort?: ResultSortDto;
}
export declare class AirportQueryDto {
    query?: string;
}
