import { Controller, Get, Inject, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FlightsService } from './flights.service.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { AirportSearchQueryDto } from './dto/airport-search-query.dto.js';
import { DestinationsQueryDto } from './dto/destinations-query.dto.js';
import { FlightSearchQueryDto } from './dto/flight-search-query.dto.js';
import { SearchFlightsDto, AirportQueryDto } from './dto/search-flights.dto.js';
import { StatusByNumberDto, StatusByRouteDto } from './dto/flight-status.dto.js';

@Public()
@Controller()
export class FlightsController {
  constructor(@Inject(FlightsService) private readonly flights: FlightsService) {}

  @Get('airports')
  @Throttle({ 'public-search': { limit: 30, ttl: 60 * 1000 } })
  airports(@Query() query: AirportQueryDto) {
    return this.flights.searchAirports(query.query);
  }

  @Get('flights/airports/search')
  @Throttle({ 'public-search': { limit: 30, ttl: 60 * 1000 } })
  searchAirports(@Query() query: AirportSearchQueryDto) {
    return this.flights.searchAirports(query.q);
  }

  @Get('flights/destinations')
  @Throttle({ 'public-search': { limit: 30, ttl: 60 * 1000 } })
  searchDestinations(@Query() query: DestinationsQueryDto) {
    return this.flights.searchDestinations(query);
  }

  @Get('flights/search')
  @Throttle({ 'public-search': { limit: 30, ttl: 60 * 1000 } })
  searchFlights(@Query() query: FlightSearchQueryDto) {
    return this.flights.searchFlights(query);
  }

  @Get('flights/search/advanced')
  @Throttle({ 'public-search': { limit: 30, ttl: 60 * 1000 } })
  advancedSearch(@Query() query: SearchFlightsDto) {
    return this.flights.searchAdvanced(query);
  }

  @Get('flights/adjacent')
  @Throttle({ 'public-search': { limit: 30, ttl: 60 * 1000 } })
  adjacent(@Query() query: SearchFlightsDto) {
    return this.flights.adjacentDates(query);
  }

  @Get('flights/status/by-number')
  @Throttle({ 'public-search': { limit: 30, ttl: 60 * 1000 } })
  statusByNumber(@Query() query: StatusByNumberDto) {
    return this.flights.statusByNumber(query.flightNumber, query.date);
  }

  @Get('flights/status/by-route')
  @Throttle({ 'public-search': { limit: 30, ttl: 60 * 1000 } })
  statusByRoute(@Query() query: StatusByRouteDto) {
    return this.flights.statusByRoute(query.origin, query.destination);
  }

  @Get('flights/:id')
  @Throttle({ 'public-search': { limit: 30, ttl: 60 * 1000 } })
  getFlight(@Param('id', ParseUUIDPipe) id: string) {
    return this.flights.getFlight(id);
  }
}
