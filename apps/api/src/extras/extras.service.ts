import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ExtraPricingUnit, ExtraService, ExtraServiceCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { priceExtraLines } from '../bookings/booking-pricing.js';
import { CreateExtraServiceDto } from './dto/create-extra-service.dto.js';
import { UpdateExtraServiceDto } from './dto/update-extra-service.dto.js';
import { ExtrasCatalogQueryDto } from './dto/extras-catalog-query.dto.js';
import { ExtrasQuoteDto } from './dto/extras-quote.dto.js';
import { ExtraSelectionDto } from './dto/extra-selection.dto.js';

type Db = PrismaService | Prisma.TransactionClient;

/** Per-selection rejection detail, surfaced to the client for reconciliation. */
export interface ExtraIssue {
  serviceId: string;
  code: string | null;
  reason:
    | 'UNKNOWN_SERVICE'
    | 'INACTIVE'
    | 'NOT_AVAILABLE_NOW'
    | 'CURRENCY_MISMATCH'
    | 'INVALID_QUANTITY'
    | 'PASSENGER_REQUIRED'
    | 'PASSENGER_NOT_ALLOWED'
    | 'INVALID_PASSENGER'
    | 'DUPLICATE';
}

/** A selection that passed validation, priced from the live catalog row. */
export interface ValidatedExtraLine {
  service: ExtraService;
  quantity: number;
  passengerIndex: number | null;
  unitPrice: number;
  totalPrice: number;
}

export interface PricedExtras {
  lines: ValidatedExtraLine[];
  extrasTotal: number;
}

/** Public catalog view — whitelisted metadata only, never the raw JSON column. */
export interface ExtraCatalogView {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: ExtraServiceCategory;
  pricingUnit: ExtraPricingUnit;
  /** Server-authoritative unit price. */
  price: number;
  currency: string;
  maxQuantity: number;
  requiresPassenger: boolean;
  validFrom: string | null;
  validTo: string | null;
  bagWeightKg: number | null;
  dietaryTags: string[];
  /** True only for explicitly non-binding demonstration products. */
  demonstration: boolean;
}

/** Whitelisted, category-meaningful metadata keys exposed to clients. */
function metadataView(metadata: Prisma.JsonValue | null): Pick<ExtraCatalogView, 'bagWeightKg' | 'dietaryTags' | 'demonstration'> {
  const m = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};
  return {
    bagWeightKg: typeof m['bagWeightKg'] === 'number' ? m['bagWeightKg'] : null,
    dietaryTags: Array.isArray(m['dietaryTags']) ? m['dietaryTags'].filter((t): t is string => typeof t === 'string') : [],
    demonstration: m['demonstration'] === true,
  };
}

function toCatalogView(s: ExtraService): ExtraCatalogView {
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    description: s.description,
    category: s.category,
    pricingUnit: s.pricingUnit,
    price: Number(s.price),
    currency: s.currency,
    maxQuantity: s.maxQuantity,
    requiresPassenger: s.requiresPassenger,
    validFrom: s.validFrom?.toISOString() ?? null,
    validTo: s.validTo?.toISOString() ?? null,
    ...metadataView(s.metadata),
  };
}

const asDate = (value: string | null | undefined): Date | null =>
  value === null || value === undefined ? null : new Date(value);

@Injectable()
export class ExtrasService {
  private readonly logger = new Logger(ExtrasService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  // ---------- Customer catalog & quote ----------

  /**
   * Active, currently-available extras eligible for the given flight/cabin.
   * Eligibility rule: the service currency must equal the fare currency of the
   * booked cabin (totals never mix currencies) and the optional validity
   * window must cover now.
   */
  async catalog(query: ExtrasCatalogQueryDto): Promise<ExtraCatalogView[]> {
    const fare = await this.fareFor(query.flightId, query.cabinClass);
    const now = new Date();
    const services = await this.prisma.extraService.findMany({
      where: { status: 'ACTIVE', currency: fare.currency },
      orderBy: [{ category: 'asc' }, { price: 'asc' }, { code: 'asc' }],
    });
    return services.filter((s) => this.isAvailableNow(s, now)).map(toCatalogView);
  }

  /**
   * Read-only quote: identical validation + pricing as booking creation.
   * Throws the same EXTRAS_INVALID error shape on rejection.
   */
  async quote(dto: ExtrasQuoteDto) {
    const fare = await this.fareFor(dto.flightId, dto.cabinClass);
    const priced = await this.validateAndPrice(dto.selections, {
      currency: fare.currency,
      passengerCount: dto.passengerCount,
    });
    return {
      currency: fare.currency,
      lines: priced.lines.map((l) => ({
        serviceId: l.service.id,
        code: l.service.code,
        name: l.service.name,
        category: l.service.category,
        pricingUnit: l.service.pricingUnit,
        quantity: l.quantity,
        passengerIndex: l.passengerIndex,
        unitPrice: l.unitPrice,
        totalPrice: l.totalPrice,
      })),
      extrasTotal: priced.extrasTotal,
    };
  }

  private async fareFor(flightId: string, cabinClass: string) {
    const flight = await this.prisma.flight.findUnique({
      where: { id: flightId },
      include: { fares: { where: { cabinClass: cabinClass as never } } },
    });
    if (!flight) {
      throw new NotFoundException('Flight not found');
    }
    const fare = flight.fares[0];
    if (!fare) {
      throw new BadRequestException(`Cabin ${cabinClass} is not offered on flight ${flight.flightNumber}`);
    }
    return fare;
  }

  private isAvailableNow(s: ExtraService, now: Date): boolean {
    if (s.validFrom && s.validFrom.getTime() > now.getTime()) return false;
    if (s.validTo && s.validTo.getTime() <= now.getTime()) return false;
    return true;
  }

  /**
   * Validates selections against the live catalog and prices them from
   * database rows. Used by the quote endpoint AND inside the booking-creation
   * transaction (pass `tx`), so a service that was deactivated or repriced
   * between selection and booking is rejected/repriced from current data —
   * never from client input.
   */
  async validateAndPrice(
    selections: ExtraSelectionDto[],
    context: { currency: string; passengerCount: number },
    tx?: Prisma.TransactionClient,
  ): Promise<PricedExtras> {
    const db: Db = tx ?? this.prisma;
    const now = new Date();
    const issues: ExtraIssue[] = [];

    const seen = new Set<string>();
    for (const sel of selections) {
      const key = `${sel.serviceId}:${sel.passengerIndex ?? ''}`;
      if (seen.has(key)) {
        issues.push({ serviceId: sel.serviceId, code: null, reason: 'DUPLICATE' });
      }
      seen.add(key);
    }

    const ids = [...new Set(selections.map((s) => s.serviceId))];
    const services = await db.extraService.findMany({ where: { id: { in: ids } } });
    const byId = new Map(services.map((s) => [s.id, s]));

    const validLines: { service: ExtraService; quantity: number; passengerIndex: number | null }[] = [];
    for (const sel of selections) {
      const service = byId.get(sel.serviceId);
      if (!service) {
        issues.push({ serviceId: sel.serviceId, code: null, reason: 'UNKNOWN_SERVICE' });
        continue;
      }
      const issue = (reason: ExtraIssue['reason']) =>
        issues.push({ serviceId: service.id, code: service.code, reason });

      if (service.status !== 'ACTIVE') issue('INACTIVE');
      if (!this.isAvailableNow(service, now)) issue('NOT_AVAILABLE_NOW');
      if (service.currency !== context.currency) issue('CURRENCY_MISMATCH');

      const passengerIndex = sel.passengerIndex ?? null;
      switch (service.pricingUnit) {
        case 'PER_ITEM':
          if (sel.quantity < 1 || sel.quantity > service.maxQuantity) issue('INVALID_QUANTITY');
          break;
        case 'PER_PASSENGER':
        case 'PER_BOOKING':
          if (sel.quantity !== 1) issue('INVALID_QUANTITY');
          break;
      }
      const needsPassenger = service.requiresPassenger || service.pricingUnit === 'PER_PASSENGER';
      if (service.pricingUnit === 'PER_BOOKING' && passengerIndex !== null) {
        issue('PASSENGER_NOT_ALLOWED');
      } else if (needsPassenger && passengerIndex === null) {
        issue('PASSENGER_REQUIRED');
      } else if (passengerIndex !== null && passengerIndex >= context.passengerCount) {
        issue('INVALID_PASSENGER');
      }

      validLines.push({ service, quantity: sel.quantity, passengerIndex });
    }

    if (issues.length > 0) {
      throw new BadRequestException({
        code: 'EXTRAS_INVALID',
        message: 'One or more selected extras are not available for this booking',
        issues,
      });
    }

    const priced = priceExtraLines(
      validLines.map((l) => ({ quantity: l.quantity, unitPrice: l.service.price })),
    );
    return {
      lines: validLines.map((l, i) => ({
        ...l,
        unitPrice: priced.lines[i]!.unitPrice,
        totalPrice: priced.lines[i]!.totalPrice,
      })),
      extrasTotal: priced.extrasTotal,
    };
  }

  // ---------- Staff catalog management (extras:read / extras:manage) ----------

  async findAllAdmin(query: { status?: string; category?: string }): Promise<ExtraCatalogView[]> {
    const services = await this.prisma.extraService.findMany({
      where: {
        status: query.status as never,
        category: query.category as never,
      },
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
    });
    return services.map(toCatalogView);
  }

  async findOneAdmin(id: string): Promise<ExtraCatalogView> {
    const service = await this.prisma.extraService.findUnique({ where: { id } });
    if (!service) {
      throw new NotFoundException('Extra service not found');
    }
    return toCatalogView(service);
  }

  async create(dto: CreateExtraServiceDto, actor: AuthUser): Promise<ExtraCatalogView> {
    this.assertConsistent({
      category: dto.category,
      pricingUnit: dto.pricingUnit,
      requiresPassenger: dto.requiresPassenger ?? false,
      metadata: dto.metadata ?? null,
      validFrom: asDate(dto.validFrom),
      validTo: asDate(dto.validTo),
    });
    let service: ExtraService;
    try {
      service = await this.prisma.extraService.create({
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description ?? null,
          price: dto.price,
          currency: dto.currency,
          category: dto.category,
          pricingUnit: dto.pricingUnit,
          maxQuantity: dto.maxQuantity ?? 1,
          requiresPassenger: dto.requiresPassenger ?? false,
          validFrom: asDate(dto.validFrom),
          validTo: asDate(dto.validTo),
          metadata: (dto.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`An extra service with code ${dto.code} already exists`);
      }
      throw error;
    }
    await this.logAdminEvent('EXTRA_SERVICE_CREATED', actor, service);
    return toCatalogView(service);
  }

  async update(id: string, dto: UpdateExtraServiceDto, actor: AuthUser): Promise<ExtraCatalogView> {
    const existing = await this.prisma.extraService.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Extra service not found');
    }
    // Validate the MERGED result so a partial update cannot leave the row in
    // a state that creation would have rejected.
    this.assertConsistent({
      category: dto.category ?? existing.category,
      pricingUnit: dto.pricingUnit ?? existing.pricingUnit,
      requiresPassenger: dto.requiresPassenger ?? existing.requiresPassenger,
      metadata: dto.metadata === undefined ? existing.metadata : dto.metadata,
      validFrom: dto.validFrom === undefined ? existing.validFrom : asDate(dto.validFrom),
      validTo: dto.validTo === undefined ? existing.validTo : asDate(dto.validTo),
    });
    const service = await this.prisma.extraService.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        currency: dto.currency,
        category: dto.category,
        status: dto.status,
        pricingUnit: dto.pricingUnit,
        maxQuantity: dto.maxQuantity,
        requiresPassenger: dto.requiresPassenger,
        validFrom: dto.validFrom === undefined ? undefined : asDate(dto.validFrom),
        validTo: dto.validTo === undefined ? undefined : asDate(dto.validTo),
        metadata: dto.metadata === undefined ? undefined : dto.metadata === null ? Prisma.JsonNull : (dto.metadata as Prisma.InputJsonValue),
      },
    });
    await this.logAdminEvent('EXTRA_SERVICE_UPDATED', actor, service);
    return toCatalogView(service);
  }

  /** Lifecycle-based removal: deactivates the service (booking rows keep RESTRICT references). */
  async deactivate(id: string, actor: AuthUser): Promise<ExtraCatalogView> {
    const existing = await this.prisma.extraService.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Extra service not found');
    }
    if (existing.status === 'INACTIVE') {
      return toCatalogView(existing);
    }
    const service = await this.prisma.extraService.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
    await this.logAdminEvent('EXTRA_SERVICE_DEACTIVATED', actor, service);
    return toCatalogView(service);
  }

  /**
   * Server-side catalog invariants. Category metadata is validated here so
   * category-specific claims (bag weight, dietary tags, demo status) can never
   * be asserted by a row that doesn't carry the data.
   */
  private assertConsistent(input: {
    category: ExtraServiceCategory;
    pricingUnit: ExtraPricingUnit;
    requiresPassenger: boolean;
    metadata: unknown;
    validFrom: Date | null;
    validTo: Date | null;
  }): void {
    if (input.validFrom && input.validTo && input.validFrom.getTime() >= input.validTo.getTime()) {
      throw new BadRequestException('validFrom must be before validTo');
    }
    if (input.pricingUnit === 'PER_PASSENGER' && !input.requiresPassenger) {
      throw new BadRequestException('PER_PASSENGER services must require a passenger association');
    }
    if (input.pricingUnit === 'PER_BOOKING' && input.requiresPassenger) {
      throw new BadRequestException('PER_BOOKING services cannot require a passenger association');
    }

    const metadata = input.metadata;
    const m = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : null;
    if (metadata !== null && m === null) {
      throw new BadRequestException('metadata must be an object');
    }
    const keys = Object.keys(m ?? {});
    const allowedByCategory: Record<ExtraServiceCategory, string[]> = {
      BAGGAGE: ['bagWeightKg'],
      MEAL: ['dietaryTags'],
      PRIORITY: [],
      INSURANCE: ['demonstration'],
    };
    const unknown = keys.filter((k) => !allowedByCategory[input.category].includes(k));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `metadata keys [${unknown.join(', ')}] are not supported for category ${input.category}`,
      );
    }

    switch (input.category) {
      case 'BAGGAGE': {
        // Explicit allowance rule: a baggage extra must declare the bag weight
        // it sells — nothing about baggage allowances is implied.
        const kg = m?.['bagWeightKg'];
        if (typeof kg !== 'number' || !Number.isFinite(kg) || kg <= 0 || kg > 64) {
          throw new BadRequestException('BAGGAGE services require metadata.bagWeightKg (0 < kg ≤ 64)');
        }
        break;
      }
      case 'MEAL': {
        const tags = m?.['dietaryTags'];
        if (tags !== undefined && (!Array.isArray(tags) || tags.some((t) => typeof t !== 'string'))) {
          throw new BadRequestException('MEAL metadata.dietaryTags must be an array of strings');
        }
        break;
      }
      case 'INSURANCE': {
        // Demo/provider boundary: no insurer integration exists, so the catalog
        // refuses any insurance product that is not explicitly flagged as a
        // non-binding demonstration. Real coverage requires a provider
        // integration first.
        if (m?.['demonstration'] !== true) {
          throw new BadRequestException({
            code: 'INSURANCE_PROVIDER_REQUIRED',
            message:
              'Insurance services require a provider integration; only explicitly-flagged demonstration products (metadata.demonstration = true) can be catalogued',
          });
        }
        break;
      }
      case 'PRIORITY':
        break;
    }
  }

  private async logAdminEvent(action: string, actor: AuthUser, service: ExtraService): Promise<void> {
    try {
      await this.auditService.log({
        actorId: actor.userId,
        actorType: 'Staff',
        action,
        targetType: 'ExtraService',
        targetId: service.id,
        metadata: { code: service.code, category: service.category, price: Number(service.price), currency: service.currency },
      });
    } catch (error) {
      // Audit failure must not break an already-committed catalog operation.
      this.logger.warn(`audit log failed for ${action} ${service.code}: ${String(error)}`);
    }
  }
}
