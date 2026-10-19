import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CabinClass, DiscountType, Offer, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { CreateOfferDto } from './dto/create-offer.dto.js';
import { UpdateOfferDto } from './dto/update-offer.dto.js';
import { AdminOfferQueryDto } from './dto/admin-offer-query.dto.js';

const asDbDate = (date: string): Date => new Date(`${date}T00:00:00Z`);
const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

const OFFER_NOT_AVAILABLE = { code: 'OFFER_NOT_AVAILABLE', message: 'Offer is not available' };

/**
 * Discount terms that can actually be applied at booking time — the single
 * source of truth shared by the public `bookable` flag and assertBookable(),
 * so the page can never advertise an offer that booking would then reject.
 * Presence alone is not enough: the ranges below are the same ones booking
 * enforces, which matters for a row written straight to the database and
 * therefore bypassing the admin API's assertValidDiscount() guard.
 * PERCENT must be in (0, 100]; FIXED_AMOUNT must be > 0.
 */
function hasValidDiscountTerms(
  discountType: DiscountType | null,
  discountValue: Prisma.Decimal | null,
): boolean {
  if (discountType === null || discountValue === null) return false;
  const value = Number(discountValue);
  if (!Number.isFinite(value)) return false;
  return discountType === 'PERCENT' ? value > 0 && value <= 100 : value > 0;
}

export type OfferDiscountView = { type: 'PERCENT' | 'FIXED_AMOUNT'; value: number };
export type OfferEligibilityView = {
  routeId: string | null;
  originIata: string | null;
  destinationIata: string | null;
  cabinClass: CabinClass | null;
};

/**
 * Discount terms in the shape the API exposes them, or null when the row
 * carries none that booking could honour. A half-configured or out-of-range
 * pair is reported as null (i.e. not bookable) rather than as a fabricated
 * value — assertValidDiscount()/assertBookable() remain the reject path.
 */
function toDiscountView(offer: Offer): OfferDiscountView | null {
  const { discountType, discountValue } = offer;
  if (discountType === null || discountValue === null) return null;
  if (!hasValidDiscountTerms(discountType, discountValue)) return null;
  return { type: discountType, value: Number(discountValue) };
}

/** Eligibility scope as stored, plus the IATA codes resolved from the route. */
function toEligibilityView(offer: OfferWithRoute): OfferEligibilityView {
  return {
    routeId: offer.routeId,
    originIata: offer.route?.originAirport.iataCode ?? null,
    destinationIata: offer.route?.destinationAirport.iataCode ?? null,
    cabinClass: offer.cabinClass,
  };
}

const publicRouteInclude = {
  route: { include: { originAirport: true, destinationAirport: true } },
} satisfies Prisma.OfferInclude;

type OfferWithRoute = Prisma.OfferGetPayload<{ include: typeof publicRouteInclude }>;

/**
 * Derived, display-only lifecycle state for the admin list. Deliberately NOT
 * a Prisma enum value: nothing here is ever persisted, and the stored
 * `status` column keeps only OfferStatus (DRAFT | ACTIVE | INACTIVE | EXPIRED).
 * SCHEDULED exists solely because an ACTIVE offer whose validFrom has not
 * arrived is published but not yet visible to customers.
 */
export type OfferLifecycleStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'EXPIRED' | 'INACTIVE';

/**
 * Admin row: the persisted offer plus every field the admin list and the
 * edit form need. `status` stays the raw stored value; `lifecycleStatus` is
 * what the UI shows. `bookable` keeps the same meaning as the public view
 * (valid discount terms exist) — it is NOT a claim that the offer can be
 * booked today; combine it with `lifecycleStatus` for that.
 *
 * `discount`/`eligibility` mirror the public view exactly, so the edit form
 * can initialise and round-trip an offer's terms from this single response
 * instead of needing a second lookup. Raw columns remain present and are the
 * persisted source of truth.
 */
export type OfferAdminView = OfferWithRoute & {
  lifecycleStatus: OfferLifecycleStatus;
  bookable: boolean;
  discount: OfferDiscountView | null;
  eligibility: OfferEligibilityView | null;
};

/**
 * Lifecycle for the admin list, derived from the stored status and the
 * validity window using the exact same UTC date semantics as publicWhere()
 * (see visibilityWindow), so the admin list can never disagree with the public
 * API about whether an offer is currently live.
 *
 * Stored DRAFT/INACTIVE/EXPIRED keep their meaning regardless of dates:
 * an offer an author never published, one staff deliberately switched off,
 * and one already recorded as ended are three different situations. Only an
 * ACTIVE offer is reinterpreted by its dates — it becomes SCHEDULED before
 * its window opens and EXPIRED once the window has closed (there is no
 * scheduled ACTIVE→EXPIRED job; public visibility is date-filtered instead).
 */
function lifecycleStatusOf(offer: Offer, now: Date, todayStart: Date): OfferLifecycleStatus {
  switch (offer.status) {
    case 'DRAFT':
      return 'DRAFT';
    case 'INACTIVE':
      return 'INACTIVE';
    case 'EXPIRED':
      return 'EXPIRED';
    case 'ACTIVE':
      if (offer.validFrom > now) return 'SCHEDULED';
      if (offer.validUntil < todayStart) return 'EXPIRED';
      return 'ACTIVE';
  }
}

/** Customer-facing view: presentation fields only, no admin internals. */
export interface OfferPublicView {
  id: string;
  title: string;
  description: string;
  badge: string | null;
  destination: string | null;
  offerValue: string | null;
  terms: string | null;
  imageUrl: string | null;
  validFrom: Date;
  validUntil: Date;
  bookable: boolean;
  discount: { type: 'PERCENT' | 'FIXED_AMOUNT'; value: number } | null;
  eligibility: {
    routeId: string | null;
    originIata: string | null;
    destinationIata: string | null;
    cabinClass: CabinClass | null;
  } | null;
}

@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  // ---------- Customer (public) ----------

  /**
   * Server-side eligibility: ACTIVE status and today inside the validity
   * window. The validity columns are date-typed (UTC midnight), so an offer
   * must stay visible through the whole of its final day — comparing
   * validUntil against the current timestamp would hide it after 00:00.
   */
  private visibilityWindow() {
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return { now, todayStart };
  }

  private publicWhere() {
    const { now, todayStart } = this.visibilityWindow();
    return { status: 'ACTIVE' as const, validFrom: { lte: now }, validUntil: { gte: todayStart } };
  }

  /** Row-level mirror of publicWhere() for single-offer availability checks. */
  private isVisibleNow(offer: Offer): boolean {
    const { now, todayStart } = this.visibilityWindow();
    return offer.status === 'ACTIVE' && offer.validFrom <= now && offer.validUntil >= todayStart;
  }

  async findPublic(): Promise<OfferPublicView[]> {
    const offers = await this.prisma.offer.findMany({
      where: this.publicWhere(),
      include: publicRouteInclude,
      orderBy: [{ validFrom: 'desc' }, { title: 'asc' }],
    });
    return offers.map((o) => this.toPublicView(o));
  }

  async findPublicOne(id: string): Promise<OfferPublicView> {
    const offer = await this.prisma.offer.findFirst({ where: { id, ...this.publicWhere() }, include: publicRouteInclude });
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }
    return this.toPublicView(offer);
  }

  // ---------- Admin ----------

  /**
   * Admin listing. Every persisted offer is returned — no validity filter —
   * so expired and future-dated records stay manageable; the derived
   * lifecycleStatus tells the UI how to label them. The optional `status`
   * query param filters on the *stored* status, not the derived one.
   */
  async findAllAdmin(query: AdminOfferQueryDto): Promise<OfferAdminView[]> {
    const offers = await this.prisma.offer.findMany({
      where: { status: query.status },
      // Same relation as the public view so discount/eligibility resolve
      // originIata/destinationIata identically on both endpoints.
      include: publicRouteInclude,
      orderBy: [{ status: 'asc' }, { validFrom: 'desc' }],
    });
    return offers.map((o) => this.toAdminView(o));
  }

  private toAdminView(offer: OfferWithRoute): OfferAdminView {
    const { now, todayStart } = this.visibilityWindow();
    const discount = toDiscountView(offer);
    return {
      ...offer,
      lifecycleStatus: lifecycleStatusOf(offer, now, todayStart),
      bookable: discount !== null,
      discount,
      eligibility: discount ? toEligibilityView(offer) : null,
    };
  }

  async findOneAdmin(id: string): Promise<Offer> {
    const offer = await this.prisma.offer.findUnique({ where: { id } });
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }
    return offer;
  }

  async create(dto: CreateOfferDto, actor: AuthUser): Promise<Offer> {
    this.assertValidRange(dto.validFrom, dto.validUntil);
    await this.assertValidDiscount(dto.discountType, dto.discountValue, dto.routeId);
    await this.assertTitleAvailable(dto.title);
    try {
      const offer = await this.prisma.offer.create({
        data: {
          title: dto.title,
          description: dto.description,
          badge: dto.badge,
          destination: dto.destination,
          offerValue: dto.offerValue,
          terms: dto.terms,
          imageUrl: dto.imageUrl,
          status: dto.status ?? 'DRAFT',
          validFrom: asDbDate(dto.validFrom),
          validUntil: asDbDate(dto.validUntil),
          discountType: dto.discountType,
          discountValue: dto.discountValue,
          routeId: dto.routeId,
          cabinClass: dto.cabinClass,
        },
      });
      await this.logOfferEvent('OFFER_CREATED', actor, offer);
      return offer;
    } catch (error) {
      this.rethrowUnique(error, dto.title);
      throw error;
    }
  }

  async update(id: string, dto: UpdateOfferDto, actor: AuthUser): Promise<Offer> {
    const existing = await this.findOneAdmin(id);
    const validFrom = dto.validFrom ?? isoDate(existing.validFrom);
    const validUntil = dto.validUntil ?? isoDate(existing.validUntil);
    this.assertValidRange(validFrom, validUntil);
    // Explicit null on either discount member clears the pair (marketing-only);
    // null on one member plus a non-null value on the other is contradictory.
    const clearsDiscount = dto.discountType === null || dto.discountValue === null;
    if (clearsDiscount && (dto.discountType != null || dto.discountValue != null)) {
      throw new BadRequestException('Cannot clear the discount while setting one of discountType/discountValue');
    }
    // Merge with the existing row (undefined = keep, null = clear) and validate the target state.
    const discountType = clearsDiscount ? null : dto.discountType !== undefined ? dto.discountType : existing.discountType;
    const discountValue = clearsDiscount ? null : dto.discountValue !== undefined ? dto.discountValue : existing.discountValue;
    const routeId = dto.routeId !== undefined ? dto.routeId : existing.routeId;
    await this.assertValidDiscount(discountType, discountValue, routeId);
    const title = dto.title ?? existing.title;
    if (title !== existing.title) {
      await this.assertTitleAvailable(title);
    }
    try {
      const offer = await this.prisma.offer.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          badge: dto.badge,
          destination: dto.destination,
          offerValue: dto.offerValue,
          terms: dto.terms,
          imageUrl: dto.imageUrl,
          status: dto.status,
          validFrom: asDbDate(validFrom),
          validUntil: asDbDate(validUntil),
          discountType: clearsDiscount ? null : dto.discountType,
          discountValue: clearsDiscount ? null : dto.discountValue,
          routeId: dto.routeId,
          cabinClass: dto.cabinClass,
        },
      });
      await this.logOfferEvent('OFFER_UPDATED', actor, offer);
      return offer;
    } catch (error) {
      this.rethrowUnique(error, title);
      throw error;
    }
  }

  /** Project convention is lifecycle-based deletion: deactivate, never hard-delete. */
  async deactivate(id: string, actor: AuthUser): Promise<Offer> {
    const existing = await this.findOneAdmin(id);
    if (existing.status === 'INACTIVE') {
      throw new ConflictException('Offer is already inactive');
    }
    const offer = await this.prisma.offer.update({ where: { id }, data: { status: 'INACTIVE' } });
    await this.logOfferEvent('OFFER_DELETED', actor, offer);
    return offer;
  }

  /** Hard delete, allowed only while no booking references the offer. */
  async deletePermanent(id: string, actor: AuthUser): Promise<Offer> {
    await this.findOneAdmin(id);
    const bookingCount = await this.prisma.booking.count({ where: { offerId: id } });
    if (bookingCount > 0) {
      throw new ConflictException({
        code: 'OFFER_IN_USE',
        message: 'Offer is referenced by existing bookings',
        bookingCount,
      });
    }
    const offer = await this.prisma.offer.delete({ where: { id } });
    await this.logOfferEvent('OFFER_HARD_DELETED', actor, offer);
    return offer;
  }

  // ---------- Booking integration (BR-16) ----------

  /**
   * Guards applying an offer to a booking: the offer must exist, be publicly
   * visible (same status/window semantics as publicWhere), carry valid
   * bookable discount terms, and match the flight's route and cabin.
   */
  async assertBookable(
    offerId: string,
    context: { routeId: string; cabinClass: CabinClass },
    tx?: Prisma.TransactionClient,
  ): Promise<Offer> {
    const offer = await (tx ?? this.prisma).offer.findUnique({ where: { id: offerId } });
    if (!offer) {
      throw new NotFoundException({ code: 'OFFER_NOT_FOUND', message: 'Offer not found' });
    }
    if (!this.isVisibleNow(offer)) {
      throw new ConflictException(OFFER_NOT_AVAILABLE);
    }
    if (!hasValidDiscountTerms(offer.discountType, offer.discountValue)) {
      throw new ConflictException(OFFER_NOT_AVAILABLE);
    }
    if ((offer.routeId !== null && offer.routeId !== context.routeId) || (offer.cabinClass !== null && offer.cabinClass !== context.cabinClass)) {
      throw new ConflictException(OFFER_NOT_AVAILABLE);
    }
    return offer;
  }

  // ---------- Internals ----------

  private assertValidRange(validFrom: string, validUntil: string): void {
    if (validFrom > validUntil) {
      throw new BadRequestException('validFrom must be on or before validUntil');
    }
  }

  /** Cross-field bookable-terms rules; discount applies to the fare basePrice only. */
  private async assertValidDiscount(
    discountType: DiscountType | null | undefined,
    discountValue: number | Prisma.Decimal | null | undefined,
    routeId: string | null | undefined,
  ): Promise<void> {
    if ((discountType == null) !== (discountValue == null)) {
      throw new BadRequestException('discountType and discountValue must be provided together');
    }
    if (discountType != null && discountValue != null) {
      const value = Number(discountValue);
      if (discountType === 'PERCENT' && (value <= 0 || value > 100)) {
        throw new BadRequestException('discountValue for PERCENT must be greater than 0 and at most 100');
      }
      if (discountType === 'FIXED_AMOUNT' && value <= 0) {
        throw new BadRequestException('discountValue for FIXED_AMOUNT must be greater than 0');
      }
    }
    if (routeId) {
      const route = await this.prisma.route.findUnique({ where: { id: routeId } });
      if (!route) {
        throw new BadRequestException('routeId does not reference an existing route');
      }
    }
  }

  private async assertTitleAvailable(title: string): Promise<void> {
    const taken = await this.prisma.offer.findUnique({ where: { title } });
    if (taken) {
      throw new ConflictException(`An offer titled "${title}" already exists`);
    }
  }

  private rethrowUnique(error: unknown, title: string): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(`An offer titled "${title}" already exists`);
    }
  }

  private async logOfferEvent(action: string, actor: AuthUser, offer: Offer): Promise<void> {
    try {
      await this.auditService.log({
        actorId: actor.userId,
        actorType: 'Staff',
        action,
        targetType: 'Offer',
        targetId: offer.id,
        metadata: { title: offer.title },
      });
    } catch (error) {
      this.logger.warn(`audit log failed for ${action} ${offer.id}: ${String(error)}`);
    }
  }

  private toPublicView(offer: OfferWithRoute): OfferPublicView {
    // bookable and discount/eligibility are kept in lockstep: terms booking
    // cannot honour are never exposed as bookable to the customer.
    const discount = toDiscountView(offer);
    return {
      id: offer.id,
      title: offer.title,
      description: offer.description,
      badge: offer.badge,
      destination: offer.destination,
      offerValue: offer.offerValue,
      terms: offer.terms,
      imageUrl: offer.imageUrl,
      validFrom: offer.validFrom,
      validUntil: offer.validUntil,
      bookable: discount !== null,
      discount,
      eligibility: discount ? toEligibilityView(offer) : null,
    };
  }
}
