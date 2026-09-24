var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { mapAirport, mapFlight } from './flight-response.mapper.js';
const FLIGHT_INCLUDE = {
    route: { include: { originAirport: true, destinationAirport: true } },
    aircraft: { include: { seats: true } },
    segments: { include: { originAirport: true, destinationAirport: true }, orderBy: { segmentNumber: 'asc' } },
    fares: true,
};
const BOOKABLE_STATUSES = ['SCHEDULED', 'ACTIVE', 'DELAYED'];
let FlightsService = class FlightsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async searchAirports(query) {
        const q = query?.trim();
        const airports = await this.prisma.airport.findMany({
            where: q
                ? {
                    OR: [
                        { iataCode: { contains: q, mode: 'insensitive' } },
                        { name: { contains: q, mode: 'insensitive' } },
                        { city: { contains: q, mode: 'insensitive' } },
                        { country: { contains: q, mode: 'insensitive' } },
                    ],
                }
                : undefined,
            orderBy: { iataCode: 'asc' },
            take: 20,
        });
        return airports.map(mapAirport);
    }
    async searchFlights(dto) {
        const dayStart = new Date(`${dto.depart}T00:00:00.000Z`);
        const dayEnd = new Date(`${dto.depart}T23:59:59.999Z`);
        const flights = await this.prisma.flight.findMany({
            where: {
                status: { in: [...BOOKABLE_STATUSES] },
                departureTime: { gte: dayStart, lte: dayEnd },
                route: {
                    originAirport: { iataCode: dto.origin.toUpperCase() },
                    destinationAirport: { iataCode: dto.destination.toUpperCase() },
                },
                fares: {
                    some: {
                        cabinClass: dto.cabin,
                        availableCount: { gt: 0 },
                    },
                },
            },
            include: FLIGHT_INCLUDE,
            orderBy: { departureTime: 'asc' },
        });
        let results = flights.map(mapFlight);
        results = this.applyFilters(results, dto);
        results = this.applySort(results, dto);
        return results;
    }
    async adjacentDates(dto) {
        const base = new Date(`${dto.depart}T00:00:00.000Z`);
        const days = [];
        for (let offset = -3; offset <= 3; offset++) {
            const day = new Date(base);
            day.setUTCDate(day.getUTCDate() + offset);
            const dateStr = day.toISOString().slice(0, 10);
            const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
            const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);
            const flights = await this.prisma.flight.findMany({
                where: {
                    status: { not: 'CANCELLED' },
                    departureTime: { gte: dayStart, lte: dayEnd },
                    route: {
                        originAirport: { iataCode: dto.origin.toUpperCase() },
                        destinationAirport: { iataCode: dto.destination.toUpperCase() },
                    },
                },
                include: { fares: { where: { cabinClass: dto.cabin } } },
            });
            const prices = flights.flatMap((f) => f.fares.map((fare) => Number(fare.basePrice) + Number(fare.taxAmount) + Number(fare.feeAmount)));
            days.push({ date: dateStr, minPrice: prices.length ? Math.min(...prices) : null });
        }
        return days;
    }
    async getFlight(id) {
        const flight = await this.prisma.flight.findUnique({
            where: { id },
            include: FLIGHT_INCLUDE,
        });
        if (!flight) {
            throw new NotFoundException('Flight not found');
        }
        return mapFlight(flight);
    }
    async statusByNumber(flightNumber, date) {
        const where = {
            flightNumber: { contains: flightNumber.trim(), mode: 'insensitive' },
        };
        if (date) {
            where.departureTime = {
                gte: new Date(`${date}T00:00:00.000Z`),
                lte: new Date(`${date}T23:59:59.999Z`),
            };
        }
        const flights = await this.prisma.flight.findMany({
            where,
            include: FLIGHT_INCLUDE,
            orderBy: { departureTime: 'asc' },
            take: 20,
        });
        return flights.map(mapFlight);
    }
    async statusByRoute(originCode, destinationCode) {
        const flights = await this.prisma.flight.findMany({
            where: {
                route: {
                    originAirport: { iataCode: originCode.toUpperCase() },
                    destinationAirport: { iataCode: destinationCode.toUpperCase() },
                },
            },
            include: FLIGHT_INCLUDE,
            orderBy: { departureTime: 'asc' },
            take: 20,
        });
        return flights.map(mapFlight);
    }
    fareTotal(flight, cabin) {
        const fare = flight.fares.find((f) => f.cabinClass === cabin) ?? flight.fares[0];
        return fare.basePrice + fare.taxAmount + fare.feeAmount;
    }
    applyFilters(flights, dto) {
        return flights.filter((f) => {
            const fare = f.fares.find((x) => x.cabinClass === dto.cabin) ?? f.fares[0];
            const total = fare.basePrice + fare.taxAmount + fare.feeAmount;
            if (dto.maxPrice != null && total > dto.maxPrice)
                return false;
            if (dto.refundableOnly === 'true' && !fare.rules.refundable)
                return false;
            if (dto.departureWindow) {
                const h = new Date(f.departureTime).getHours();
                const inWindow = dto.departureWindow === 'morning' ? h < 12
                    : dto.departureWindow === 'afternoon' ? h >= 12 && h < 18
                        : h >= 18;
                if (!inWindow)
                    return false;
            }
            if (dto.stops === 'nonstop' && f.segments.length > 1)
                return false;
            return true;
        });
    }
    applySort(flights, dto) {
        const totalOf = (f) => this.fareTotal(f, dto.cabin);
        const durationOf = (f) => new Date(f.arrivalTime).getTime() - new Date(f.departureTime).getTime();
        const list = [...flights];
        switch (dto.sort) {
            case 'price':
                return list.sort((a, b) => totalOf(a) - totalOf(b));
            case 'duration':
                return list.sort((a, b) => durationOf(a) - durationOf(b));
            case 'departure':
                return list.sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime());
            case 'recommended':
                return list.sort((a, b) => totalOf(a) * 0.7 + durationOf(a) / 60000 - (totalOf(b) * 0.7 + durationOf(b) / 60000));
            default:
                return list;
        }
    }
};
FlightsService = __decorate([
    Injectable(),
    __param(0, Inject(PrismaService)),
    __metadata("design:paramtypes", [PrismaService])
], FlightsService);
export { FlightsService };
//# sourceMappingURL=flights.service.js.map