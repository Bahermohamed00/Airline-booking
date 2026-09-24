import { Controller, Get, Inject, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FlightsService } from './flights.service.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { SearchFlightsDto, AirportQueryDto } from './dto/search-flights.dto.js';
import { StatusByNumberDto, StatusByRouteDto } from './dto/flight-status.dto.js';

@Public()
@Controller()
export class FlightsController {
  constructor(@Inject(FlightsService) private readonly flights: FlightsService) {}

  /** Public airport autocomplete source (FR-C04). */
  @Throttle({ 'public-search': {} })
  @Get('airports')
  airports(@Query() query: AirportQueryDto) {
    return this.flights.searchAirports(query.query);
  }

  /** Public flight search with trip type, passengers, cabin, filters, sort (FR-C04/05/06). */
  @Throttle({ 'public-search': {} })
  @Get('flights/search')
  search(@Query() dto: SearchFlightsDto) {
    return this.flights.searchFlights(dto);
  }

  /** Adjacent-date price strip for the results page. */
  @Throttle({ 'public-search': {} })
  @Get('flights/adjacent')
  adjacent(@Query() dto: SearchFlightsDto) {
    return this.flights.adjacentDates(dto);
  }

  /** Public flight status by flight number (FR-C19). */
  @Throttle({ 'public-search': {} })
  @Get('flights/status/by-number')
  statusByNumber(@Query() dto: StatusByNumberDto) {
    return this.flights.statusByNumber(dto.flightNumber, dto.date);
  }

  /** Public flight status by origin/destination (FR-C19). */
  @Throttle({ 'public-search': {} })
  @Get('flights/status/by-route')
  statusByRoute(@Query() dto: StatusByRouteDto) {
    return this.flights.statusByRoute(dto.origin, dto.destination);
  }

  /** Public flight details (FR-C07). */
  @Throttle({ 'public-search': {} })
  @Get('flights/:id')
  getFlight(@Param('id', ParseUUIDPipe) id: string) {
    return this.flights.getFlight(id);
  }
}
