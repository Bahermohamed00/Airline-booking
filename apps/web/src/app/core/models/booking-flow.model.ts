import type { CabinClass, ExtraService, Fare, Flight, PassengerType, Seat } from './domain.model';
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
  promoCode?: string | null;
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

export interface ExtraSelection {
  extra: ExtraService;
  quantity: number;
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
  /** Client-side selection timer only — a real server hold starts at POST /bookings. */
  seatHoldExpiresAt: string | null;
  confirmedBooking: CustomerBooking | null;
}
