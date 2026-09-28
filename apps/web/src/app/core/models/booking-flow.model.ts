import type { CabinClass, ExtraService, Fare, Flight, PassengerType, Seat, Booking } from './domain.model';

export type TripType = 'ONE_WAY' | 'ROUND_TRIP' | 'MULTI_CITY';

export interface PassengerCounts {
  adults: number;
  children: number;
  infants: number;
}

export interface SearchLeg {
  originCode: string;
  destinationCode: string;
  departureDate: string; // yyyy-mm-dd
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
  /** Multi-city legs (2–3); only set when tripType is MULTI_CITY. */
  legs?: SearchLeg[];
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
  /** 0 = outbound, 1 = return/second leg, 2+ = additional multi-city legs. */
  legIndex?: number;
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

export interface DraftLeg {
  flight: Flight;
  fare: Fare;
}

export interface BookingDraft {
  criteria: SearchCriteria;
  outbound: Flight;
  returnFlight?: Flight | null;
  fare: Fare;
  returnFare?: Fare | null;
  /** All selected legs for multi-city trips (legs[0] mirrors outbound, legs[1] mirrors returnFlight). Empty otherwise. */
  legs: DraftLeg[];
  passengers: PassengerForm[];
  seats: SeatSelection[];
  returnSeats: SeatSelection[];
  /** Seat selections for multi-city legs 3+ (legIndex >= 2). */
  extraLegSeats: SeatSelection[];
  extras: ExtraSelection[];
  baggagePieces: number[];
  seatHoldExpiresAt: string | null;
  paymentReference: string | null;
  confirmedBooking: Booking | null;
}
