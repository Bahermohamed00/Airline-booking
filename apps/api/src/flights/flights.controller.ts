import { Controller, Get, Inject, NotFoundException, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FlightsService } from './flights.service.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { AirportSearchQueryDto } from './dto/airport-search-query.dto.js';
import { DestinationsQueryDto } from './dto/destinations-query.dto.js';
import { FlightSearchQueryDto } from './dto/flight-search-query.dto.js';

@Public()
@Controller('flights')
export class FlightsController {
  constructor(@Inject(FlightsService) private readonly flightsService: FlightsService) {}

  @Get('airports/search')
  @Throttle({ 'public-search': { limit: 30, ttl: 60 * 1000 } })
  searchAirports(@Query() query: AirportSearchQueryDto) {
    return this.flightsService.searchAirports(query);
  }

  @Get('destinations')
  @Throttle({ 'public-search': { limit: 30, ttl: 60 * 1000 } })
  searchDestinations(@Query() query: DestinationsQueryDto) {
    return this.flightsService.searchDestinations(query);
  }

  @Get('search')
  @Throttle({ 'public-search': { limit: 30, ttl: 60 * 1000 } })
  searchFlights(@Query() query: FlightSearchQueryDto) {
    return this.flightsService.searchFlights(query);
  }

  @Get(':id')
  async getFlight(@Param('id', ParseUUIDPipe) id: string) {
    const flight = await this.flightsService.getFlight(id);
    if (!flight) {
      throw new NotFoundException('Flight not found');
    }
    return flight;
  }
}
