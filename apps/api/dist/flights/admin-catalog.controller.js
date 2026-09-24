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
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, ParseUUIDPipe, Patch, Post, } from '@nestjs/common';
import { AdminCatalogService } from './admin-catalog.service.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { CreateAirportDto, UpdateAirportDto, CreateRouteDto, UpdateRouteDto, CreateAircraftDto, UpdateAircraftDto, CreateFlightDto, UpdateFlightDto, CreateFareDto, UpdateFareDto, CreateSegmentDto, } from './dto/admin-catalog.dto.js';
let AdminCatalogController = class AdminCatalogController {
    catalog;
    constructor(catalog) {
        this.catalog = catalog;
    }
    airports() {
        return this.catalog.listAirports();
    }
    createAirport(dto, user) {
        return this.catalog.createAirport(dto, user.userId);
    }
    updateAirport(id, dto, user) {
        return this.catalog.updateAirport(id, dto, user.userId);
    }
    deactivateAirport(id, user) {
        return this.catalog.deactivateAirport(id, user.userId);
    }
    routes() {
        return this.catalog.listRoutes();
    }
    createRoute(dto, user) {
        return this.catalog.createRoute(dto, user.userId);
    }
    updateRoute(id, dto, user) {
        return this.catalog.updateRoute(id, dto, user.userId);
    }
    aircraft() {
        return this.catalog.listAircraft();
    }
    createAircraft(dto, user) {
        return this.catalog.createAircraft(dto, user.userId);
    }
    updateAircraft(id, dto, user) {
        return this.catalog.updateAircraft(id, dto, user.userId);
    }
    flights() {
        return this.catalog.listFlights();
    }
    createFlight(dto, user) {
        return this.catalog.createFlight(dto, user.userId);
    }
    updateFlight(id, dto, user) {
        return this.catalog.updateFlight(id, dto, user.userId);
    }
    addSegment(id, dto, user) {
        return this.catalog.addSegment(id, dto, user.userId);
    }
    addFare(id, dto, user) {
        return this.catalog.addFare(id, dto, user.userId);
    }
    updateFare(id, dto, user) {
        return this.catalog.updateFare(id, dto, user.userId);
    }
    async deleteFare(id, user) {
        await this.catalog.deleteFare(id, user.userId);
    }
};
__decorate([
    Get('airports'),
    Permissions({ resource: 'airports', action: 'manage' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "airports", null);
__decorate([
    Post('airports'),
    Permissions({ resource: 'airports', action: 'manage' }),
    __param(0, Body()),
    __param(1, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateAirportDto, Object]),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "createAirport", null);
__decorate([
    Patch('airports/:id'),
    Permissions({ resource: 'airports', action: 'manage' }),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Body()),
    __param(2, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateAirportDto, Object]),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "updateAirport", null);
__decorate([
    Delete('airports/:id'),
    Permissions({ resource: 'airports', action: 'manage' }),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "deactivateAirport", null);
__decorate([
    Get('routes'),
    Permissions({ resource: 'routes', action: 'manage' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "routes", null);
__decorate([
    Post('routes'),
    Permissions({ resource: 'routes', action: 'manage' }),
    __param(0, Body()),
    __param(1, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateRouteDto, Object]),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "createRoute", null);
__decorate([
    Patch('routes/:id'),
    Permissions({ resource: 'routes', action: 'manage' }),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Body()),
    __param(2, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateRouteDto, Object]),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "updateRoute", null);
__decorate([
    Get('aircraft'),
    Permissions({ resource: 'aircraft', action: 'manage' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "aircraft", null);
__decorate([
    Post('aircraft'),
    Permissions({ resource: 'aircraft', action: 'manage' }),
    __param(0, Body()),
    __param(1, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateAircraftDto, Object]),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "createAircraft", null);
__decorate([
    Patch('aircraft/:id'),
    Permissions({ resource: 'aircraft', action: 'manage' }),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Body()),
    __param(2, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateAircraftDto, Object]),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "updateAircraft", null);
__decorate([
    Get('flights'),
    Permissions({ resource: 'flights', action: 'read' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "flights", null);
__decorate([
    Post('flights'),
    Permissions({ resource: 'flights', action: 'manage' }),
    __param(0, Body()),
    __param(1, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateFlightDto, Object]),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "createFlight", null);
__decorate([
    Patch('flights/:id'),
    Permissions({ resource: 'flights', action: 'manage' }),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Body()),
    __param(2, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateFlightDto, Object]),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "updateFlight", null);
__decorate([
    Post('flights/:id/segments'),
    Permissions({ resource: 'flights', action: 'manage' }),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Body()),
    __param(2, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, CreateSegmentDto, Object]),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "addSegment", null);
__decorate([
    Post('flights/:id/fares'),
    Permissions({ resource: 'flights', action: 'manage' }),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Body()),
    __param(2, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, CreateFareDto, Object]),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "addFare", null);
__decorate([
    Patch('fares/:id'),
    Permissions({ resource: 'flights', action: 'manage' }),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, Body()),
    __param(2, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateFareDto, Object]),
    __metadata("design:returntype", void 0)
], AdminCatalogController.prototype, "updateFare", null);
__decorate([
    Delete('fares/:id'),
    HttpCode(HttpStatus.NO_CONTENT),
    Permissions({ resource: 'flights', action: 'manage' }),
    __param(0, Param('id', ParseUUIDPipe)),
    __param(1, CurrentUser()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminCatalogController.prototype, "deleteFare", null);
AdminCatalogController = __decorate([
    Controller('admin'),
    __param(0, Inject(AdminCatalogService)),
    __metadata("design:paramtypes", [AdminCatalogService])
], AdminCatalogController);
export { AdminCatalogController };
//# sourceMappingURL=admin-catalog.controller.js.map