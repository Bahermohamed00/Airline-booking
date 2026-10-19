import type { CabinClass, Fare, Flight, PassengerType, Seat } from './domain.model';
import type { ExtraCatalogItem } from './extras.model';
import type { CustomerBooking } from './customer-booking.model';

export type TripType = 'ONE_WAY' | 'ROUND_TRIP' | 'MULTI_CITY';

export interface PassengerCounts {
  adults: number;
  children: number;
  infants: number;
}

export interface SearchCriteria {
  tripType: TripType;
  originCode: string;
  destinationCode: string;
  departureDate: string; // yyyy-mm-dd
  returnDate?: string | null;
  passengers: PassengerCounts;
  cabinClass: CabinClass;
  /** BR-16: bookable offer carried from /offers deep links into checkout. */
  offerId?: string | null;
}

export interface ResultFilters {
  maxPrice?: number | null;
  departureWindow?: 'morning' | 'afternoon' | 'evening' | null;
  stops?: 'any' | 'nonstop';
  refundableOnly: boolean;
  cabinClass?: CabinClass | null;
}

export type ResultSort = 'recommended' | 'price' | 'duration' | 'departure';

export interface PassengerForm {
  passengerType: PassengerType;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  passportNumber: string;
  specialAssistance?: string | null;
}

export interface SeatSelection {
  passengerIndex: number;
  seat: Seat;
}

/**
 * A chosen extra in the draft. `service` is the server-returned catalog item
 * (unit price included); passengerIndex links passenger-associated services
 * (meals, bags, per-passenger priority/insurance) to a traveller.
 */
export interface ExtraSelection {
  service: ExtraCatalogItem;
  quantity: number;
  passengerIndex: number | null;
}

export interface PriceBreakdown {
  baseFare: number;
  taxes: number;
  fees: number;
  baggage: number;
  extras: number;
  seatCharges: number;
  discount: number;
  total: number;
  currency: string;
}

export interface BookingDraft {
  criteria: SearchCriteria;
  outbound: Flight;
  returnFlight?: Flight | null;
  fare: Fare;
  returnFare?: Fare | null;
  passengers: PassengerForm[];
  contactEmail: string;
  contactPhone: string;
  seats: SeatSelection[];
  returnSeats: SeatSelection[];
  extras: ExtraSelection[];
  baggagePieces: number[];
  /** BR-16: offer carried from criteria into the create payload; null when none. */
  offerId: string | null;
  /** Client-side selection timer only — a real server hold starts at POST /bookings. */
  seatHoldExpiresAt: string | null;
  confirmedBooking: CustomerBooking | null;
}
