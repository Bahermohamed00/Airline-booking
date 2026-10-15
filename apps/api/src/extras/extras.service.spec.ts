import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ExtrasService } from './extras.service';

const user = { userId: 'staff-1', email: 'staff@example.com', roles: ['Booking Manager'], permissions: ['extras:manage'] };

const future = (ms: number) => new Date(Date.now() + ms);
const past = (ms: number) => new Date(Date.now() - ms);

/** Catalog row as Prisma would return it (plain number price is fine — the service Number()s it). */
const svc = (overrides: Record<string, unknown> = {}) => ({
  id: 'svc-1',
  code: 'BAG_23KG',
  name: 'Extra checked bag (23 kg)',
  description: null,
  price: 65,
  currency: 'EUR',
  status: 'ACTIVE',
  category: 'BAGGAGE',
  pricingUnit: 'PER_ITEM',
  maxQuantity: 3,
  requiresPassenger: true,
  validFrom: null,
  validTo: null,
  metadata: { bagWeightKg: 23 },
  ...overrides,
});

const flightWithFare = (currency = 'EUR') => ({
  id: 'flight-1',
  flightNumber: 'NV100',
  fares: [{ id: 'fare-1', cabinClass: 'ECONOMY', currency }],
});

const createMockPrisma = () => ({
  flight: { findUnique: vi.fn().mockResolvedValue(flightWithFare()) },
  extraService: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
});

const CTX = { currency: 'EUR', passengerCount: 2 };

describe('ExtrasService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let audit: { log: ReturnType<typeof vi.fn> };
  let service: ExtrasService;

  beforeEach(() => {
    prisma = createMockPrisma();
    audit = { log: vi.fn().mockResolvedValue({}) };
    service = new ExtrasService(prisma as never, audit as never);
  });

  describe('catalog', () => {
    it('returns active, in-window services in the fare currency, ordered by category and price', async () => {
      const active = svc({ id: 'a', price: 10 });
      const otherCurrency = svc({ id: 'b', currency: 'USD' });
      const expired = svc({ id: 'c', validTo: past(1000) });
      const notYetValid = svc({ id: 'd', validFrom: future(86_400_000) });
      prisma.extraService.findMany.mockResolvedValue([active, expired, notYetValid]);

      const result = await service.catalog({ flightId: 'flight-1', cabinClass: 'ECONOMY' } as never);

      // The query itself scopes to ACTIVE + fare currency; the window filter runs in code.
      expect(prisma.extraService.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'ACTIVE', currency: 'EUR' } }),
      );
      expect(result.map((r) => r.id)).toEqual(['a']);
      expect(result[0]).toMatchObject({ code: 'BAG_23KG', price: 10, bagWeightKg: 23, demonstration: false });
      void otherCurrency;
    });

    it('rejects an unknown flight with 404 and an unoffered cabin with 400', async () => {
      prisma.flight.findUnique.mockResolvedValue(null);
      await expect(service.catalog({ flightId: 'x', cabinClass: 'ECONOMY' } as never)).rejects.toBeInstanceOf(NotFoundException);

      prisma.flight.findUnique.mockResolvedValue({ ...flightWithFare(), fares: [] });
      await expect(service.catalog({ flightId: 'flight-1', cabinClass: 'BUSINESS' } as never)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('validateAndPrice', () => {
    it('prices valid selections from database rows — client input carries no price', async () => {
      prisma.extraService.findMany.mockResolvedValue([svc({ price: 65 })]);
      const result = await service.validateAndPrice(
        [{ serviceId: 'svc-1', quantity: 2, passengerIndex: 0 }],
        CTX,
      );
      expect(result.extrasTotal).toBe(130);
      expect(result.lines[0]).toMatchObject({ unitPrice: 65, totalPrice: 130, quantity: 2, passengerIndex: 0 });
    });

    it('rejects unknown service ids', async () => {
      prisma.extraService.findMany.mockResolvedValue([]);
      await expect(
        service.validateAndPrice([{ serviceId: 'nope', quantity: 1 }], CTX),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'EXTRAS_INVALID', issues: [expect.objectContaining({ reason: 'UNKNOWN_SERVICE' })] }),
      });
    });

    it('rejects inactive services', async () => {
      prisma.extraService.findMany.mockResolvedValue([svc({ status: 'INACTIVE' })]);
      await expect(
        service.validateAndPrice([{ serviceId: 'svc-1', quantity: 1, passengerIndex: 0 }], CTX),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ issues: [expect.objectContaining({ reason: 'INACTIVE' })] }),
      });
    });

    it('rejects services outside their validity window (past validTo / future validFrom)', async () => {
      prisma.extraService.findMany.mockResolvedValue([svc({ validTo: past(1000) })]);
      await expect(
        service.validateAndPrice([{ serviceId: 'svc-1', quantity: 1, passengerIndex: 0 }], CTX),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ issues: [expect.objectContaining({ reason: 'NOT_AVAILABLE_NOW' })] }),
      });

      prisma.extraService.findMany.mockResolvedValue([svc({ validFrom: future(86_400_000) })]);
      await expect(
        service.validateAndPrice([{ serviceId: 'svc-1', quantity: 1, passengerIndex: 0 }], CTX),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ issues: [expect.objectContaining({ reason: 'NOT_AVAILABLE_NOW' })] }),
      });
    });

    it('rejects services priced in a different currency than the booking', async () => {
      prisma.extraService.findMany.mockResolvedValue([svc({ currency: 'USD' })]);
      await expect(
        service.validateAndPrice([{ serviceId: 'svc-1', quantity: 1, passengerIndex: 0 }], CTX),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ issues: [expect.objectContaining({ reason: 'CURRENCY_MISMATCH' })] }),
      });
    });

    it('rejects quantities above the catalog maxQuantity', async () => {
      prisma.extraService.findMany.mockResolvedValue([svc({ maxQuantity: 3 })]);
      await expect(
        service.validateAndPrice([{ serviceId: 'svc-1', quantity: 4, passengerIndex: 0 }], CTX),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ issues: [expect.objectContaining({ reason: 'INVALID_QUANTITY' })] }),
      });
    });

    it('rejects duplicate selections of the same service for the same passenger', async () => {
      prisma.extraService.findMany.mockResolvedValue([svc()]);
      await expect(
        service.validateAndPrice(
          [
            { serviceId: 'svc-1', quantity: 1, passengerIndex: 0 },
            { serviceId: 'svc-1', quantity: 2, passengerIndex: 0 },
          ],
          CTX,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ issues: [expect.objectContaining({ reason: 'DUPLICATE' })] }),
      });
    });

    it('enforces passenger association rules per pricing unit', async () => {
      // PER_PASSENGER requires a passenger, quantity exactly 1.
      const perPax = svc({ id: 'p1', pricingUnit: 'PER_PASSENGER', requiresPassenger: true, maxQuantity: 1 });
      prisma.extraService.findMany.mockResolvedValue([perPax]);
      await expect(service.validateAndPrice([{ serviceId: 'p1', quantity: 1 }], CTX)).rejects.toMatchObject({
        response: expect.objectContaining({ issues: [expect.objectContaining({ reason: 'PASSENGER_REQUIRED' })] }),
      });
      await expect(
        service.validateAndPrice([{ serviceId: 'p1', quantity: 2, passengerIndex: 0 }], CTX),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ issues: [expect.objectContaining({ reason: 'INVALID_QUANTITY' })] }),
      });

      // PER_BOOKING forbids a passenger association.
      const perBooking = svc({ id: 'b1', pricingUnit: 'PER_BOOKING', requiresPassenger: false, maxQuantity: 1 });
      prisma.extraService.findMany.mockResolvedValue([perBooking]);
      await expect(
        service.validateAndPrice([{ serviceId: 'b1', quantity: 1, passengerIndex: 0 }], CTX),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ issues: [expect.objectContaining({ reason: 'PASSENGER_NOT_ALLOWED' })] }),
      });

      // Passenger index must reference an actual booking passenger.
      prisma.extraService.findMany.mockResolvedValue([perPax]);
      await expect(
        service.validateAndPrice([{ serviceId: 'p1', quantity: 1, passengerIndex: 5 }], CTX),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ issues: [expect.objectContaining({ reason: 'INVALID_PASSENGER' })] }),
      });
    });

    it('collects multiple issues in one rejection', async () => {
      prisma.extraService.findMany.mockResolvedValue([svc({ status: 'INACTIVE' })]);
      await expect(
        service.validateAndPrice(
          [
            { serviceId: 'svc-1', quantity: 1, passengerIndex: 0 },
            { serviceId: 'gone', quantity: 1 },
          ],
          CTX,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'EXTRAS_INVALID',
          issues: expect.arrayContaining([
            expect.objectContaining({ reason: 'INACTIVE' }),
            expect.objectContaining({ reason: 'UNKNOWN_SERVICE' }),
          ]),
        }),
      });
    });

    it('quote() shares the validation path and returns priced lines', async () => {
      prisma.extraService.findMany.mockResolvedValue([svc({ price: 65 })]);
      const quote = await service.quote({
        flightId: 'flight-1',
        cabinClass: 'ECONOMY',
        passengerCount: 2,
        selections: [{ serviceId: 'svc-1', quantity: 2, passengerIndex: 0 }],
      } as never);
      expect(quote.currency).toBe('EUR');
      expect(quote.extrasTotal).toBe(130);
      expect(quote.lines[0]).toMatchObject({ code: 'BAG_23KG', unitPrice: 65, totalPrice: 130 });
    });
  });

  describe('admin catalog management', () => {
    const baseDto = {
      code: 'BAG_23KG',
      name: 'Extra checked bag (23 kg)',
      price: 65,
      currency: 'EUR',
      category: 'BAGGAGE',
      pricingUnit: 'PER_ITEM',
      maxQuantity: 3,
      requiresPassenger: true,
      metadata: { bagWeightKg: 23 },
    };

    it('creates a valid service and audits it', async () => {
      prisma.extraService.create.mockImplementation(({ data }) => Promise.resolve({ id: 'svc-1', validFrom: null, validTo: null, status: 'ACTIVE', ...data }));
      const view = await service.create(baseDto as never, user as never);
      expect(view).toMatchObject({ code: 'BAG_23KG', price: 65, bagWeightKg: 23 });
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'EXTRA_SERVICE_CREATED' }));
    });

    it('requires an explicit bag weight for baggage services', async () => {
      await expect(service.create({ ...baseDto, metadata: {} } as never, user as never)).rejects.toThrow(/bagWeightKg/);
      expect(prisma.extraService.create).not.toHaveBeenCalled();
    });

    it('refuses non-demonstration insurance products (no insurer integration exists)', async () => {
      await expect(
        service.create(
          { ...baseDto, code: 'INS_REAL', category: 'INSURANCE', pricingUnit: 'PER_PASSENGER', metadata: {} } as never,
          user as never,
        ),
      ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'INSURANCE_PROVIDER_REQUIRED' }) });

      prisma.extraService.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'svc-ins', validFrom: null, validTo: null, status: 'ACTIVE', ...data }),
      );
      const demo = await service.create(
        { ...baseDto, code: 'INS_DEMO', category: 'INSURANCE', pricingUnit: 'PER_PASSENGER', metadata: { demonstration: true } } as never,
        user as never,
      );
      expect(demo.demonstration).toBe(true);
    });
    it('rejects unknown metadata keys and inconsistent pricing unit / passenger flags', async () => {
      await expect(
        service.create({ ...baseDto, metadata: { bagWeightKg: 23, hack: true } } as never, user as never),
      ).rejects.toThrow(/not supported/);
      await expect(
        service.create({ ...baseDto, pricingUnit: 'PER_PASSENGER', requiresPassenger: false } as never, user as never),
      ).rejects.toThrow(/PER_PASSENGER/);
      await expect(
        service.create({ ...baseDto, pricingUnit: 'PER_BOOKING', requiresPassenger: true } as never, user as never),
      ).rejects.toThrow(/PER_BOOKING/);
      await expect(
        service.create({ ...baseDto, validFrom: '2026-12-01T00:00:00Z', validTo: '2026-01-01T00:00:00Z' } as never, user as never),
      ).rejects.toThrow(/validFrom/);
    });

    it('maps a duplicate code to a 409 conflict', async () => {
      const { Prisma } = await import('@prisma/client');
      prisma.extraService.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }),
      );
      await expect(service.create(baseDto as never, user as never)).rejects.toBeInstanceOf(ConflictException);
    });

    it('update validates the merged row (category change without demo metadata is rejected)', async () => {
      prisma.extraService.findUnique.mockResolvedValue(svc());
      // Category change + cleared metadata → the insurance demo boundary fires.
      await expect(
        service.update('svc-1', { category: 'INSURANCE', metadata: null } as never, user as never),
      ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'INSURANCE_PROVIDER_REQUIRED' }) });

      // Category change while keeping baggage metadata → unsupported keys rejected.
      await expect(
        service.update('svc-1', { category: 'INSURANCE' } as never, user as never),
      ).rejects.toThrow(/not supported/);

      prisma.extraService.findUnique.mockResolvedValue(null);
      await expect(service.update('gone', { price: 70 } as never, user as never)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deactivate is lifecycle-based and audited', async () => {
      prisma.extraService.findUnique.mockResolvedValue(svc());
      prisma.extraService.update.mockResolvedValue(svc({ status: 'INACTIVE' }));
      const view = await service.deactivate('svc-1', user as never);
      expect(prisma.extraService.update).toHaveBeenCalledWith({ where: { id: 'svc-1' }, data: { status: 'INACTIVE' } });
      expect(view.id).toBe('svc-1');
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'EXTRA_SERVICE_DEACTIVATED' }));
    });
  });
});
