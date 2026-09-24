const DEFAULT_FARE_RULES = {
    ECONOMY: {
        refundable: false,
        changeAllowed: true,
        changeFee: 90,
        cancellationFeePercent: 100,
        checkedBaggagePieces: 1,
        checkedBaggageWeightKg: 23,
        carryOnPieces: 1,
        seatSelectionFee: 15,
        priorityBoarding: false,
        loungeAccess: false,
        description: 'Economy Light — changes for a fee, non-refundable.',
    },
    PREMIUM_ECONOMY: {
        refundable: true,
        changeAllowed: true,
        changeFee: 0,
        cancellationFeePercent: 10,
        checkedBaggagePieces: 2,
        checkedBaggageWeightKg: 23,
        carryOnPieces: 2,
        seatSelectionFee: 0,
        priorityBoarding: true,
        loungeAccess: false,
        description: 'Premium Economy — included seat selection and free changes.',
    },
    BUSINESS: {
        refundable: true,
        changeAllowed: true,
        changeFee: 0,
        cancellationFeePercent: 10,
        checkedBaggagePieces: 2,
        checkedBaggageWeightKg: 32,
        carryOnPieces: 2,
        seatSelectionFee: 0,
        priorityBoarding: true,
        loungeAccess: true,
        description: 'Business — premium fare with lounge access and free changes.',
    },
    FIRST: {
        refundable: true,
        changeAllowed: true,
        changeFee: 0,
        cancellationFeePercent: 0,
        checkedBaggagePieces: 3,
        checkedBaggageWeightKg: 32,
        carryOnPieces: 2,
        seatSelectionFee: 0,
        priorityBoarding: true,
        loungeAccess: true,
        description: 'First — fully flexible fare with all services included.',
    },
};
export function mapAirport(a) {
    return {
        id: a.id,
        iataCode: a.iataCode,
        icaoCode: a.icaoCode,
        name: a.name,
        city: a.city,
        country: a.country,
        timezone: a.timezone,
        status: a.status,
    };
}
export function mapSeat(s) {
    return {
        id: s.id,
        aircraftId: s.aircraftId,
        seatNumber: s.seatNumber,
        cabinClass: s.cabinClass,
        seatRow: s.seatRow,
        seatColumn: s.seatColumn,
        isExitRow: s.isExitRow,
        features: s.features ?? {},
    };
}
export function mapAircraft(a) {
    return {
        id: a.id,
        registration: a.registration,
        model: a.model,
        capacity: a.capacity,
        status: a.status,
        seats: (a.seats ?? []).map(mapSeat),
    };
}
export function mapRoute(r) {
    return {
        id: r.id,
        originAirportId: r.originAirportId,
        destinationAirportId: r.destinationAirportId,
        origin: mapAirport(r.originAirport),
        destination: mapAirport(r.destinationAirport),
        distanceKm: r.distanceKm,
        durationMinutes: r.durationMinutes,
        status: r.status,
    };
}
export function mapSegment(s) {
    return {
        id: s.id,
        flightId: s.flightId,
        segmentNumber: s.segmentNumber,
        originAirportId: s.originAirportId,
        origin: mapAirport(s.originAirport),
        destinationAirportId: s.destinationAirportId,
        destination: mapAirport(s.destinationAirport),
        departureTime: s.departureTime.toISOString(),
        arrivalTime: s.arrivalTime.toISOString(),
    };
}
export function mapFare(f) {
    return {
        id: f.id,
        flightId: f.flightId,
        cabinClass: f.cabinClass,
        basePrice: Number(f.basePrice),
        taxAmount: Number(f.taxAmount),
        feeAmount: Number(f.feeAmount),
        currency: f.currency,
        availableCount: f.availableCount,
        rules: f.fareRules ?? DEFAULT_FARE_RULES[f.cabinClass],
    };
}
export function mapFlight(f) {
    return {
        id: f.id,
        flightNumber: f.flightNumber,
        routeId: f.routeId,
        route: mapRoute(f.route),
        aircraftId: f.aircraftId,
        aircraft: mapAircraft(f.aircraft),
        departureTime: f.departureTime.toISOString(),
        arrivalTime: f.arrivalTime.toISOString(),
        status: f.status,
        scheduleStatus: f.scheduleStatus,
        segments: f.segments.map(mapSegment),
        fares: f.fares.map(mapFare),
    };
}
//# sourceMappingURL=flight-response.mapper.js.map