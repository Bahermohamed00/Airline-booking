var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { IsDateString, IsOptional, IsString, Length, Matches } from 'class-validator';
export class StatusByNumberDto {
    flightNumber;
    date;
}
__decorate([
    IsString(),
    Matches(/^[A-Za-z0-9]{2,10}$/),
    __metadata("design:type", String)
], StatusByNumberDto.prototype, "flightNumber", void 0);
__decorate([
    IsOptional(),
    IsDateString(),
    __metadata("design:type", String)
], StatusByNumberDto.prototype, "date", void 0);
export class StatusByRouteDto {
    origin;
    destination;
}
__decorate([
    IsString(),
    Length(3, 3),
    __metadata("design:type", String)
], StatusByRouteDto.prototype, "origin", void 0);
__decorate([
    IsString(),
    Length(3, 3),
    __metadata("design:type", String)
], StatusByRouteDto.prototype, "destination", void 0);
//# sourceMappingURL=flight-status.dto.js.map