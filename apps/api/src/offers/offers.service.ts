import { Injectable } from '@nestjs/common';
import { AirportStatus, FlightStatus, OfferStatus, Prisma, RouteStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { DEFAULT_FARE_RULES } from '../flights/flights.service.js';
import type { OffersQueryDto } from './dto/offers-query.dto.js';

const airportSelect = {
  iataCode: true,
  name: true,
  city: true,
  country: true,
} satisfies Prisma.AirportSelect;

const offerInclude = {
  flight: {
    include: {
      route: {
        include: {
          originAirport: { select: airportSelect },
          destinationAirport: { select: airportSelect },
        },
      },
      // The (flightId, cabinClass) pair is unique on fares, so this yields the
      // one fare the offer discounts.
      fares: true,
    },
  },
} satisfies Prisma.OfferInclude;

type OfferWithRelations = Prisma.OfferGetPayload<{ include: typeof offerInclude }>;

const BOOKABLE_STATUSES: FlightStatus[] = [FlightStatus.SCHEDULED, FlightStatus.ACTIVE, FlightStatus.DELAYED];

@Injectable()
export class OffersService {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(query: OffersQueryDto) {
    const now = new Date();
    const where: Prisma.OfferWhereInput = {
      status: OfferStatus.ACTIVE,
      startsAt: { lte: now },
      endsAt: { gt: now },
      flight: {
        status: { in: BOOKABLE_STATUSES },
        departureTime: { gt: now },
        route: {
          status: RouteStatus.ACTIVE,
          originAirport: { status: AirportStatus.ACTIVE },
          destinationAirport: { status: AirportStatus.ACTIVE },
        },
      },
    };
    if (query.cabin) {
      where.cabinClass = query.cabin;
    }

    const offers = await this.prisma.offer.findMany({
      where,
      include: offerInclude,
      orderBy: { endsAt: 'asc' },
      take: 60,
    });

    // Domestic/international compares two columns (origin vs destination
    // country), which Prisma can't express in a where clause — filtered here on
    // the already date/status-narrowed result set.
    const scoped = !query.scope
      ? offers
      : offers.filter((o) => {
          const domestic =
            o.flight.route.originAirport.country === o.flight.route.destinationAirport.country;
          return query.scope === 'domestic' ? domestic : !domestic;
        });

    return scoped
      .map((o) => this.toOfferResponse(o))
      .filter((o): o is NonNullable<typeof o> => o !== null);
  }

  private toOfferResponse(o: OfferWithRelations) {
    const fare = o.flight.fares.find((f) => f.cabinClass === o.cabinClass);
    if (!fare || fare.availableCount <= 0) return null;

    const originalPrice = fare.basePrice.toNumber() + fare.taxAmount.toNumber() + fare.feeAmount.toNumber();
    const discountedPrice = Math.round(originalPrice * (1 - o.discountPercentage / 100) * 100) / 100;
    const rules = (fare.fareRules ?? DEFAULT_FARE_RULES) as typeof DEFAULT_FARE_RULES;

    return {
      id: o.id,
      title: o.title,
      description: o.description,
      cabinClass: o.cabinClass,
      discountPercentage: o.discountPercentage,
      startsAt: o.startsAt.toISOString(),
      endsAt: o.endsAt.toISOString(),
      flight: {
        id: o.flight.id,
        flightNumber: o.flight.flightNumber,
        departureTime: o.flight.departureTime.toISOString(),
        arrivalTime: o.flight.arrivalTime.toISOString(),
        origin: o.flight.route.originAirport,
        destination: o.flight.route.destinationAirport,
      },
      fare: {
        id: fare.id,
        cabinClass: fare.cabinClass,
        currency: fare.currency,
        originalPrice,
        discountedPrice,
        availableCount: fare.availableCount,
        baggage: {
          checkedBaggagePieces: rules.checkedBaggagePieces,
          checkedBaggageWeightKg: rules.checkedBaggageWeightKg,
          carryOnPieces: rules.carryOnPieces,
        },
      },
    };
  }
}
