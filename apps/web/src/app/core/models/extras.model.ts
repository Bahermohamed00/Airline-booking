import type { CabinClass } from './domain.model';

// API contract for purchasable booking extras (apps/api extras module).
// All prices and eligibility are server-authoritative; the client never
// invents catalog entries and never submits prices.

export type ExtraCategory = 'BAGGAGE' | 'MEAL' | 'PRIORITY' | 'INSURANCE';
export type ExtraPricingUnit = 'PER_ITEM' | 'PER_PASSENGER' | 'PER_BOOKING';

/** GET /api/extras/catalog item — an active, currently-eligible service. */
export interface ExtraCatalogItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: ExtraCategory;
  pricingUnit: ExtraPricingUnit;
  /** Server-controlled unit price in `currency`. */
  price: number;
  currency: string;
  maxQuantity: number;
  requiresPassenger: boolean;
  validFrom: string | null;
  validTo: string | null;
  /** BAGGAGE only: explicit bag weight this service sells. */
  bagWeightKg: number | null;
  /** MEAL only: dietary information backed by catalog data. */
  dietaryTags: string[];
  /** True only for explicitly non-binding demonstration products (insurance). */
  demonstration: boolean;
}

/** Selection wire format (POST /extras/quote, POST /bookings, price-preview). */
export interface ExtraSelectionPayload {
  serviceId: string;
  quantity: number;
  passengerIndex?: number;
}

/** One priced line of a server quote / price preview. */
export interface ExtraQuoteLine {
  serviceId: string;
  code: string;
  name: string;
  category: ExtraCategory;
  pricingUnit: ExtraPricingUnit;
  quantity: number;
  passengerIndex: number | null;
  unitPrice: number;
  totalPrice: number;
}

/** POST /api/extras/quote response. */
export interface ExtrasQuote {
  currency: string;
  lines: ExtraQuoteLine[];
  extrasTotal: number;
}

/** Structured rejection body of quote/create when selections are invalid. */
export interface ExtrasInvalidError {
  code: 'EXTRAS_INVALID';
  message: string;
  issues: Array<{
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
  }>;
}

/** One extras line on a confirmed/pending booking (snapshot fields). */
export interface CustomerBookingExtra {
  id: string;
  serviceId: string;
  code: string;
  name: string;
  category: ExtraCategory;
  pricingUnit: ExtraPricingUnit;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  currency: string;
  passengerIndex: number | null;
}

export interface ExtrasCatalogQuery {
  flightId: string;
  cabinClass: CabinClass;
}
