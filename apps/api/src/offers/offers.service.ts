import { BadRequestException, ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Offer, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { CreateOfferDto } from './dto/create-offer.dto.js';
import { UpdateOfferDto } from './dto/update-offer.dto.js';
import { AdminOfferQueryDto } from './dto/admin-offer-query.dto.js';

const asDbDate = (date: string): Date => new Date(`${date}T00:00:00Z`);
const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

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
}

@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  // ---------- Customer (public) ----------

  /** Server-side eligibility: ACTIVE status and today inside the validity window. */
  private publicWhere() {
    const today = new Date();
    return { status: 'ACTIVE' as const, validFrom: { lte: today }, validUntil: { gte: today } };
  }

  async findPublic(): Promise<OfferPublicView[]> {
    const offers = await this.prisma.offer.findMany({
      where: this.publicWhere(),
      orderBy: [{ validFrom: 'desc' }, { title: 'asc' }],
    });
    return offers.map((o) => this.toPublicView(o));
  }

  async findPublicOne(id: string): Promise<OfferPublicView> {
    const offer = await this.prisma.offer.findFirst({ where: { id, ...this.publicWhere() } });
    if (!offer) {
      throw new NotFoundException('Offer not found');
    }
    return this.toPublicView(offer);
  }

  // ---------- Admin ----------

  findAllAdmin(query: AdminOfferQueryDto): Promise<Offer[]> {
    return this.prisma.offer.findMany({
      where: { status: query.status },
      orderBy: [{ status: 'asc' }, { validFrom: 'desc' }],
    });
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

  // ---------- Internals ----------

  private assertValidRange(validFrom: string, validUntil: string): void {
    if (validFrom > validUntil) {
      throw new BadRequestException('validFrom must be on or before validUntil');
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

  private toPublicView(offer: Offer): OfferPublicView {
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
    };
  }
}
