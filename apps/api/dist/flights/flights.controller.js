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
import { Controller, Get, Inject, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FlightsService } from './flights.service.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { SearchFlightsDto, AirportQueryDto } from './dto/search-flights.dto.js';
import { StatusByNumberDto, StatusByRouteDto } from './dto/flight-status.dto.js';
let FlightsController = class FlightsController {
    flights;
    constructor(flights) {
        this.flights = flights;
    }
    airports(query) {
        return this.flights.searchAirports(query.query);
    }
    search(dto) {
        return this.flights.searchFlights(dto);
    }
    adjacent(dto) {
        return this.flights.adjacentDates(dto);
    }
    statusByNumber(dto) {
        return this.flights.statusByNumber(dto.flightNumber, dto.date);
    }
    statusByRoute(dto) {
        return this.flights.statusByRoute(dto.origin, dto.destination);
    }
    getFlight(id) {
        return this.flights.getFlight(id);
    }
};
__decorate([
    Throttle({ 'public-search': {} }),
    Get('airports'),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [AirportQueryDto]),
    __metadata("design:returntype", void 0)
], FlightsController.prototype, "airports", null);
__decorate([
    Throttle({ 'public-search': {} }),
    Get('flights/search'),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SearchFlightsDto]),
    __metadata("design:returntype", void 0)
], FlightsController.prototype, "search", null);
__decorate([
    Throttle({ 'public-search': {} }),
    Get('flights/adjacent'),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SearchFlightsDto]),
    __metadata("design:returntype", void 0)
], FlightsController.prototype, "adjacent", null);
__decorate([
    Throttle({ 'public-search': {} }),
    Get('flights/status/by-number'),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [StatusByNumberDto]),
    __metadata("design:returntype", void 0)
], FlightsController.prototype, "statusByNumber", null);
__decorate([
    Throttle({ 'public-search': {} }),
    Get('flights/status/by-route'),
    __param(0, Query()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [StatusByRouteDto]),
    __metadata("design:returntype", void 0)
], FlightsController.prototype, "statusByRoute", null);
__decorate([
    Throttle({ 'public-search': {} }),
    Get('flights/:id'),
    __param(0, Param('id', ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FlightsController.prototype, "getFlight", null);
FlightsController = __decorate([
    Public(),
    Controller(),
    __param(0, Inject(FlightsService)),
    __metadata("design:paramtypes", [FlightsService])
], FlightsController);
export { FlightsController };
//# sourceMappingURL=flights.controller.js.map