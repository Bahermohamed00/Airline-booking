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
import { Inject, Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { mapAircraft, mapAirport, mapFlight, mapRoute, mapFare } from './flight-response.mapper.js';
let AdminCatalogService = class AdminCatalogService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    listAirports() {
        return this.prisma.airport.findMany({ orderBy: { iataCode: 'asc' } }).then((rows) => rows.map(mapAirport));
    }
    async createAirport(dto, actorId) {
        const existing = await this.prisma.airport.findUnique({ where: { iataCode: dto.iataCode } });
        if (existing)
            throw new ConflictException('IATA code already in use');
        const airport = await this.prisma.airport.create({ data: dto });
        await this.logAudit(actorId, 'AIRPORT_CREATED', 'Airport', airport.id);
        return mapAirport(airport);
    }
    async updateAirport(id, dto, actorId) {
        await this.mustAirport(id);
        const airport = await this.prisma.airport.update({ where: { id }, data: dto });
        await this.logAudit(actorId, 'AIRPORT_UPDATED', 'Airport', id, { changedFields: Object.keys(dto) });
        return mapAirport(airport);
    }
    async deactivateAirport(id, actorId) {
        await this.mustAirport(id);
        const airport = await this.prisma.airport.update({ where: { id }, data: { status: 'INACTIVE' } });
        await this.logAudit(actorId, 'AIRPORT_DEACTIVATED', 'Airport', id);
        return mapAirport(airport);
    }
    listRoutes() {
        return this.prisma.route
            .findMany({ include: { originAirport: true, destinationAirport: true } })
            .then((rows) => rows.map(mapRoute));
    }
    async createRoute(dto, actorId) {
        if (dto.originAirportId === dto.destinationAirportId) {
            throw new BadRequestException('Origin and destination must differ');
        }
        const [origin, destination] = await Promise.all([
            this.prisma.airport.findUnique({ where: { id: dto.originAirportId } }),
            this.prisma.airport.findUnique({ where: { id: dto.destinationAirportId } }),
        ]);
        if (!origin || !destination)
            throw new NotFoundException('Airport not found');
        const existing = await this.prisma.route.findUnique({
            where: { originAirportId_destinationAirportId: { originAirportId: dto.originAirportId, destinationAirportId: dto.destinationAirportId } },
        });
        if (existing)
            throw new ConflictException('Route already exists');
        const route = await this.prisma.route.create({
            data: dto,
            include: { originAirport: true, destinationAirport: true },
        });
        await this.logAudit(actorId, 'ROUTE_CREATED', 'Route', route.id);
        return mapRoute(route);
    }
    async updateRoute(id, dto, actorId) {
        const route = await this.prisma.route.update({
            where: { id },
            data: dto,
            include: { originAirport: true, destinationAirport: true },
        });
        await this.logAudit(actorId, 'ROUTE_UPDATED', 'Route', id, { changedFields: Object.keys(dto) });
        return mapRoute(route);
    }
    listAircraft() {
        return this.prisma.aircraft.findMany({ include: { seats: true }, orderBy: { registration: 'asc' } }).then((rows) => rows.map(mapAircraft));
    }
    async createAircraft(dto, actorId) {
        const existing = await this.prisma.aircraft.findUnique({ where: { registration: dto.registration } });
        if (existing)
            throw new ConflictException('Registration already in use');
        const aircraft = await this.prisma.aircraft.create({ data: dto });
        await this.prisma.seat.createMany({ data: this.generateSeats(aircraft.id, aircraft.capacity) });
        const withSeats = await this.prisma.aircraft.findUniqueOrThrow({ where: { id: aircraft.id }, include: { seats: true } });
        await this.logAudit(actorId, 'AIRCRAFT_CREATED', 'Aircraft', aircraft.id);
        return mapAircraft(withSeats);
    }
    async updateAircraft(id, dto, actorId) {
        const aircraft = await this.prisma.aircraft.update({ where: { id }, data: dto, include: { seats: true } });
        await this.logAudit(actorId, 'AIRCRAFT_UPDATED', 'Aircraft', id, { changedFields: Object.keys(dto) });
        return mapAircraft(aircraft);
    }
    generateSeats(aircraftId, capacity) {
        const seats = [];
        const cols = ['A', 'B', 'C', 'D', 'E', 'F'];
        const totalRows = Math.ceil(capacity / 6);
        let count = 0;
        for (let row = 1; row <= totalRows && count < capacity; row++) {
            for (const col of cols) {
                if (count >= capacity)
                    break;
                seats.push({
                    aircraftId,
                    seatNumber: `${row}${col}`,
                    cabinClass: row <= 2 && capacity >= 300 ? 'FIRST' : row <= 6 && capacity >= 220 ? 'BUSINESS' : 'ECONOMY',
                    seatRow: row,
                    seatColumn: col,
                    isExitRow: row === 12 || row === 25,
                    features: {},
                });
                count++;
            }
        }
        return seats;
    }
    listFlights() {
        return this.prisma.flight
            .findMany({
            include: {
                route: { include: { originAirport: true, destinationAirport: true } },
                aircraft: { include: { seats: true } },
                segments: { include: { originAirport: true, destinationAirport: true }, orderBy: { segmentNumber: 'asc' } },
                fares: true,
            },
            orderBy: { departureTime: 'asc' },
        })
            .then((rows) => rows.map(mapFlight));
    }
    async createFlight(dto, actorId) {
        if (new Date(dto.arrivalTime) <= new Date(dto.departureTime)) {
            throw new BadRequestException('Arrival must be after departure');
        }
        const [route, aircraft] = await Promise.all([
            this.prisma.route.findUnique({ where: { id: dto.routeId }, include: { originAirport: true, destinationAirport: true } }),
            this.prisma.aircraft.findUnique({ where: { id: dto.aircraftId } }),
        ]);
        if (!route)
            throw new NotFoundException('Route not found');
        if (!aircraft)
            throw new NotFoundException('Aircraft not found');
        const flight = await this.prisma.$transaction(async (tx) => {
            const created = await tx.flight.create({
                data: {
                    flightNumber: dto.flightNumber,
                    routeId: dto.routeId,
                    aircraftId: dto.aircraftId,
                    departureTime: new Date(dto.departureTime),
                    arrivalTime: new Date(dto.arrivalTime),
                },
            });
            const segments = dto.segments?.length
                ? dto.segments
                : [
                    {
                        segmentNumber: 1,
                        originAirportId: route.originAirportId,
                        destinationAirportId: route.destinationAirportId,
                        departureTime: dto.departureTime,
                        arrivalTime: dto.arrivalTime,
                    },
                ];
            await tx.flightSegment.createMany({
                data: segments.map((s) => ({
                    flightId: created.id,
                    segmentNumber: s.segmentNumber,
                    originAirportId: s.originAirportId,
                    destinationAirportId: s.destinationAirportId,
                    departureTime: new Date(s.departureTime),
                    arrivalTime: new Date(s.arrivalTime),
                })),
            });
            if (dto.fares?.length) {
                await tx.fare.createMany({
                    data: dto.fares.map((f) => ({ ...f, flightId: created.id })),
                });
            }
            return created;
        });
        await this.logAudit(actorId, 'FLIGHT_CREATED', 'Flight', flight.id);
        return this.getFlightById(flight.id);
    }
    async updateFlight(id, dto, actorId) {
        const flight = await this.prisma.flight.findUnique({ where: { id } });
        if (!flight)
            throw new NotFoundException('Flight not found');
        const departure = dto.departureTime ? new Date(dto.departureTime) : flight.departureTime;
        const arrival = dto.arrivalTime ? new Date(dto.arrivalTime) : flight.arrivalTime;
        if (arrival <= departure)
            throw new BadRequestException('Arrival must be after departure');
        const scheduleStatus = dto.status === 'CANCELLED' ? 'CANCELLED' : dto.status === 'DELAYED' ? 'DELAYED' : flight.scheduleStatus;
        await this.prisma.flight.update({
            where: { id },
            data: {
                departureTime: dto.departureTime ? new Date(dto.departureTime) : undefined,
                arrivalTime: dto.arrivalTime ? new Date(dto.arrivalTime) : undefined,
                aircraftId: dto.aircraftId,
                status: dto.status,
                scheduleStatus,
            },
        });
        await this.logAudit(actorId, dto.status === 'CANCELLED' ? 'FLIGHT_CANCELLED' : 'FLIGHT_UPDATED', 'Flight', id, { changedFields: Object.keys(dto) });
        return this.getFlightById(id);
    }
    async addSegment(flightId, dto, actorId) {
        const flight = await this.prisma.flight.findUnique({ where: { id: flightId } });
        if (!flight)
            throw new NotFoundException('Flight not found');
        await this.prisma.flightSegment.create({
            data: {
                flightId,
                segmentNumber: dto.segmentNumber,
                originAirportId: dto.originAirportId,
                destinationAirportId: dto.destinationAirportId,
                departureTime: new Date(dto.departureTime),
                arrivalTime: new Date(dto.arrivalTime),
            },
        });
        await this.logAudit(actorId, 'FLIGHT_SEGMENT_ADDED', 'Flight', flightId);
        return this.getFlightById(flightId);
    }
    async addFare(flightId, dto, actorId) {
        const flight = await this.prisma.flight.findUnique({ where: { id: flightId } });
        if (!flight)
            throw new NotFoundException('Flight not found');
        const fare = await this.prisma.fare.create({ data: { flightId, ...dto } });
        await this.logAudit(actorId, 'FARE_UPSERTED', 'Fare', fare.id);
        return mapFare(fare);
    }
    async updateFare(id, dto, actorId) {
        const fare = await this.prisma.fare.update({ where: { id }, data: dto });
        await this.logAudit(actorId, 'FARE_UPDATED', 'Fare', id, { changedFields: Object.keys(dto) });
        return mapFare(fare);
    }
    async deleteFare(id, actorId) {
        await this.prisma.fare.delete({ where: { id } });
        await this.logAudit(actorId, 'FARE_DELETED', 'Fare', id);
    }
    async getFlightById(id) {
        const flight = await this.prisma.flight.findUniqueOrThrow({
            where: { id },
            include: {
                route: { include: { originAirport: true, destinationAirport: true } },
                aircraft: { include: { seats: true } },
                segments: { include: { originAirport: true, destinationAirport: true }, orderBy: { segmentNumber: 'asc' } },
                fares: true,
            },
        });
        return mapFlight(flight);
    }
    async mustAirport(id) {
        const airport = await this.prisma.airport.findUnique({ where: { id } });
        if (!airport)
            throw new NotFoundException('Airport not found');
    }
    logAudit(actorId, action, targetType, targetId, metadata) {
        return this.audit.log({ actorId, actorType: 'Staff', action, targetType, targetId, metadata });
    }
};
AdminCatalogService = __decorate([
    Injectable(),
    __param(0, Inject(PrismaService)),
    __param(1, Inject(AuditService)),
    __metadata("design:paramtypes", [PrismaService,
        AuditService])
], AdminCatalogService);
export { AdminCatalogService };
//# sourceMappingURL=admin-catalog.service.js.map