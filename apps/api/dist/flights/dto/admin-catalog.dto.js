var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Matches, Max, Min, ValidateNested, } from 'class-validator';
import { CabinClassDto } from './search-flights.dto.js';
export class CreateAirportDto {
    iataCode;
    icaoCode;
    name;
    city;
    country;
    timezone;
}
__decorate([
    IsString(),
    Length(3, 3),
    Matches(/^[A-Z]{3}$/),
    __metadata("design:type", String)
], CreateAirportDto.prototype, "iataCode", void 0);
__decorate([
    IsOptional(),
    IsString(),
    Length(4, 4),
    Matches(/^[A-Z]{4}$/),
    __metadata("design:type", String)
], CreateAirportDto.prototype, "icaoCode", void 0);
__decorate([
    IsString(),
    __metadata("design:type", String)
], CreateAirportDto.prototype, "name", void 0);
__decorate([
    IsString(),
    __metadata("design:type", String)
], CreateAirportDto.prototype, "city", void 0);
__decorate([
    IsString(),
    __metadata("design:type", String)
], CreateAirportDto.prototype, "country", void 0);
__decorate([
    IsString(),
    __metadata("design:type", String)
], CreateAirportDto.prototype, "timezone", void 0);
export class UpdateAirportDto {
    name;
    city;
    country;
    timezone;
    status;
}
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], UpdateAirportDto.prototype, "name", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], UpdateAirportDto.prototype, "city", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], UpdateAirportDto.prototype, "country", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], UpdateAirportDto.prototype, "timezone", void 0);
__decorate([
    IsOptional(),
    IsEnum(['ACTIVE', 'INACTIVE']),
    __metadata("design:type", String)
], UpdateAirportDto.prototype, "status", void 0);
export class CreateRouteDto {
    originAirportId;
    destinationAirportId;
    distanceKm;
    durationMinutes;
}
__decorate([
    IsUUID('4'),
    __metadata("design:type", String)
], CreateRouteDto.prototype, "originAirportId", void 0);
__decorate([
    IsUUID('4'),
    __metadata("design:type", String)
], CreateRouteDto.prototype, "destinationAirportId", void 0);
__decorate([
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(0),
    __metadata("design:type", Number)
], CreateRouteDto.prototype, "distanceKm", void 0);
__decorate([
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(0),
    __metadata("design:type", Number)
], CreateRouteDto.prototype, "durationMinutes", void 0);
export class UpdateRouteDto {
    distanceKm;
    durationMinutes;
    status;
}
__decorate([
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(0),
    __metadata("design:type", Number)
], UpdateRouteDto.prototype, "distanceKm", void 0);
__decorate([
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(0),
    __metadata("design:type", Number)
], UpdateRouteDto.prototype, "durationMinutes", void 0);
__decorate([
    IsOptional(),
    IsEnum(['ACTIVE', 'INACTIVE']),
    __metadata("design:type", String)
], UpdateRouteDto.prototype, "status", void 0);
export class CreateAircraftDto {
    registration;
    model;
    capacity;
}
__decorate([
    IsString(),
    __metadata("design:type", String)
], CreateAircraftDto.prototype, "registration", void 0);
__decorate([
    IsString(),
    __metadata("design:type", String)
], CreateAircraftDto.prototype, "model", void 0);
__decorate([
    Type(() => Number),
    IsInt(),
    Min(1),
    Max(900),
    __metadata("design:type", Number)
], CreateAircraftDto.prototype, "capacity", void 0);
export class UpdateAircraftDto {
    model;
    capacity;
    status;
}
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], UpdateAircraftDto.prototype, "model", void 0);
__decorate([
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(1),
    Max(900),
    __metadata("design:type", Number)
], UpdateAircraftDto.prototype, "capacity", void 0);
__decorate([
    IsOptional(),
    IsEnum(['ACTIVE', 'MAINTENANCE', 'RETIRED']),
    __metadata("design:type", String)
], UpdateAircraftDto.prototype, "status", void 0);
export class CreateSegmentDto {
    segmentNumber;
    originAirportId;
    destinationAirportId;
    departureTime;
    arrivalTime;
}
__decorate([
    Type(() => Number),
    IsInt(),
    Min(1),
    __metadata("design:type", Number)
], CreateSegmentDto.prototype, "segmentNumber", void 0);
__decorate([
    IsUUID('4'),
    __metadata("design:type", String)
], CreateSegmentDto.prototype, "originAirportId", void 0);
__decorate([
    IsUUID('4'),
    __metadata("design:type", String)
], CreateSegmentDto.prototype, "destinationAirportId", void 0);
__decorate([
    IsDateString(),
    __metadata("design:type", String)
], CreateSegmentDto.prototype, "departureTime", void 0);
__decorate([
    IsDateString(),
    __metadata("design:type", String)
], CreateSegmentDto.prototype, "arrivalTime", void 0);
export class CreateFareDto {
    cabinClass;
    basePrice;
    taxAmount;
    feeAmount;
    currency;
    availableCount;
}
__decorate([
    IsEnum(CabinClassDto),
    __metadata("design:type", String)
], CreateFareDto.prototype, "cabinClass", void 0);
__decorate([
    Type(() => Number),
    IsNumber(),
    Min(0),
    __metadata("design:type", Number)
], CreateFareDto.prototype, "basePrice", void 0);
__decorate([
    IsOptional(),
    Type(() => Number),
    IsNumber(),
    Min(0),
    __metadata("design:type", Number)
], CreateFareDto.prototype, "taxAmount", void 0);
__decorate([
    IsOptional(),
    Type(() => Number),
    IsNumber(),
    Min(0),
    __metadata("design:type", Number)
], CreateFareDto.prototype, "feeAmount", void 0);
__decorate([
    IsString(),
    Length(3, 3),
    __metadata("design:type", String)
], CreateFareDto.prototype, "currency", void 0);
__decorate([
    Type(() => Number),
    IsInt(),
    Min(0),
    __metadata("design:type", Number)
], CreateFareDto.prototype, "availableCount", void 0);
export class UpdateFareDto {
    basePrice;
    taxAmount;
    feeAmount;
    availableCount;
}
__decorate([
    IsOptional(),
    Type(() => Number),
    IsNumber(),
    Min(0),
    __metadata("design:type", Number)
], UpdateFareDto.prototype, "basePrice", void 0);
__decorate([
    IsOptional(),
    Type(() => Number),
    IsNumber(),
    Min(0),
    __metadata("design:type", Number)
], UpdateFareDto.prototype, "taxAmount", void 0);
__decorate([
    IsOptional(),
    Type(() => Number),
    IsNumber(),
    Min(0),
    __metadata("design:type", Number)
], UpdateFareDto.prototype, "feeAmount", void 0);
__decorate([
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(0),
    __metadata("design:type", Number)
], UpdateFareDto.prototype, "availableCount", void 0);
export class CreateFlightDto {
    flightNumber;
    routeId;
    aircraftId;
    departureTime;
    arrivalTime;
    segments;
    fares;
}
__decorate([
    IsString(),
    Matches(/^[A-Z0-9]{2,10}$/),
    __metadata("design:type", String)
], CreateFlightDto.prototype, "flightNumber", void 0);
__decorate([
    IsUUID('4'),
    __metadata("design:type", String)
], CreateFlightDto.prototype, "routeId", void 0);
__decorate([
    IsUUID('4'),
    __metadata("design:type", String)
], CreateFlightDto.prototype, "aircraftId", void 0);
__decorate([
    IsDateString(),
    __metadata("design:type", String)
], CreateFlightDto.prototype, "departureTime", void 0);
__decorate([
    IsDateString(),
    __metadata("design:type", String)
], CreateFlightDto.prototype, "arrivalTime", void 0);
__decorate([
    IsOptional(),
    IsArray(),
    ValidateNested({ each: true }),
    Type(() => CreateSegmentDto),
    __metadata("design:type", Array)
], CreateFlightDto.prototype, "segments", void 0);
__decorate([
    IsOptional(),
    IsArray(),
    ValidateNested({ each: true }),
    Type(() => CreateFareDto),
    __metadata("design:type", Array)
], CreateFlightDto.prototype, "fares", void 0);
export class UpdateFlightDto {
    departureTime;
    arrivalTime;
    aircraftId;
    status;
}
__decorate([
    IsOptional(),
    IsDateString(),
    __metadata("design:type", String)
], UpdateFlightDto.prototype, "departureTime", void 0);
__decorate([
    IsOptional(),
    IsDateString(),
    __metadata("design:type", String)
], UpdateFlightDto.prototype, "arrivalTime", void 0);
__decorate([
    IsOptional(),
    IsUUID('4'),
    __metadata("design:type", String)
], UpdateFlightDto.prototype, "aircraftId", void 0);
__decorate([
    IsOptional(),
    IsEnum(['SCHEDULED', 'ACTIVE', 'DELAYED', 'CANCELLED', 'COMPLETED']),
    __metadata("design:type", String)
], UpdateFlightDto.prototype, "status", void 0);
//# sourceMappingURL=admin-catalog.dto.js.map