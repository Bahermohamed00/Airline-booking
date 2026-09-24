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
import { IsDateString, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';
export var TripType;
(function (TripType) {
    TripType["ONE_WAY"] = "ONE_WAY";
    TripType["ROUND_TRIP"] = "ROUND_TRIP";
    TripType["MULTI_CITY"] = "MULTI_CITY";
})(TripType || (TripType = {}));
export var CabinClassDto;
(function (CabinClassDto) {
    CabinClassDto["ECONOMY"] = "ECONOMY";
    CabinClassDto["PREMIUM_ECONOMY"] = "PREMIUM_ECONOMY";
    CabinClassDto["BUSINESS"] = "BUSINESS";
    CabinClassDto["FIRST"] = "FIRST";
})(CabinClassDto || (CabinClassDto = {}));
export var ResultSortDto;
(function (ResultSortDto) {
    ResultSortDto["RECOMMENDED"] = "recommended";
    ResultSortDto["PRICE"] = "price";
    ResultSortDto["DURATION"] = "duration";
    ResultSortDto["DEPARTURE"] = "departure";
})(ResultSortDto || (ResultSortDto = {}));
export class SearchFlightsDto {
    tripType;
    origin;
    destination;
    depart;
    return;
    adults;
    children;
    infants;
    cabin;
    promo;
    maxPrice;
    departureWindow;
    refundableOnly;
    stops;
    sort;
}
__decorate([
    IsEnum(TripType),
    __metadata("design:type", String)
], SearchFlightsDto.prototype, "tripType", void 0);
__decorate([
    IsString(),
    Length(3, 3),
    __metadata("design:type", String)
], SearchFlightsDto.prototype, "origin", void 0);
__decorate([
    IsString(),
    Length(3, 3),
    __metadata("design:type", String)
], SearchFlightsDto.prototype, "destination", void 0);
__decorate([
    IsDateString(),
    __metadata("design:type", String)
], SearchFlightsDto.prototype, "depart", void 0);
__decorate([
    IsOptional(),
    IsDateString(),
    __metadata("design:type", String)
], SearchFlightsDto.prototype, "return", void 0);
__decorate([
    Type(() => Number),
    IsInt(),
    Min(1),
    Max(9),
    __metadata("design:type", Number)
], SearchFlightsDto.prototype, "adults", void 0);
__decorate([
    Type(() => Number),
    IsInt(),
    Min(0),
    Max(8),
    __metadata("design:type", Number)
], SearchFlightsDto.prototype, "children", void 0);
__decorate([
    Type(() => Number),
    IsInt(),
    Min(0),
    Max(4),
    __metadata("design:type", Number)
], SearchFlightsDto.prototype, "infants", void 0);
__decorate([
    IsEnum(CabinClassDto),
    __metadata("design:type", String)
], SearchFlightsDto.prototype, "cabin", void 0);
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], SearchFlightsDto.prototype, "promo", void 0);
__decorate([
    IsOptional(),
    Type(() => Number),
    IsNumber(),
    Min(0),
    __metadata("design:type", Number)
], SearchFlightsDto.prototype, "maxPrice", void 0);
__decorate([
    IsOptional(),
    IsIn(['morning', 'afternoon', 'evening']),
    __metadata("design:type", String)
], SearchFlightsDto.prototype, "departureWindow", void 0);
__decorate([
    IsOptional(),
    IsIn(['true', 'false']),
    __metadata("design:type", String)
], SearchFlightsDto.prototype, "refundableOnly", void 0);
__decorate([
    IsOptional(),
    IsIn(['any', 'nonstop']),
    __metadata("design:type", String)
], SearchFlightsDto.prototype, "stops", void 0);
__decorate([
    IsOptional(),
    IsEnum(ResultSortDto),
    __metadata("design:type", String)
], SearchFlightsDto.prototype, "sort", void 0);
export class AirportQueryDto {
    query;
}
__decorate([
    IsOptional(),
    IsString(),
    __metadata("design:type", String)
], AirportQueryDto.prototype, "query", void 0);
//# sourceMappingURL=search-flights.dto.js.map