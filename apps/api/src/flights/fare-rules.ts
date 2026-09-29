import type { CabinClass } from '@prisma/client';

export interface FareRuleResponse {
  refundable: boolean;
  changeAllowed: boolean;
  changeFee: number;
  cancellationFeePercent: number;
  checkedBaggagePieces: number;
  checkedBaggageWeightKg: number;
  carryOnPieces: number;
  seatSelectionFee: number;
  priorityBoarding: boolean;
  loungeAccess: boolean;
  description: string;
}

export const DEFAULT_FARE_RULES: Record<CabinClass, FareRuleResponse> = {
  ECONOMY: {
    refundable: false,
    changeAllowed: true,
    changeFee: 90,
    cancellationFeePercent: 100,
    checkedBaggagePieces: 1,
    checkedBaggageWeightKg: 23,
    carryOnPieces: 1,
    seatSelectionFee: 15,
    priorityBoarding: false,
    loungeAccess: false,
    description: 'Economy Light — changes for a fee, non-refundable.',
  },
  PREMIUM_ECONOMY: {
    refundable: true,
    changeAllowed: true,
    changeFee: 0,
    cancellationFeePercent: 10,
    checkedBaggagePieces: 2,
    checkedBaggageWeightKg: 23,
    carryOnPieces: 2,
    seatSelectionFee: 0,
    priorityBoarding: true,
    loungeAccess: false,
    description: 'Premium Economy — included seat selection and free changes.',
  },
  BUSINESS: {
    refundable: true,
    changeAllowed: true,
    changeFee: 0,
    cancellationFeePercent: 10,
    checkedBaggagePieces: 2,
    checkedBaggageWeightKg: 32,
    carryOnPieces: 2,
    seatSelectionFee: 0,
    priorityBoarding: true,
    loungeAccess: true,
    description: 'Business — premium fare with lounge access and free changes.',
  },
  FIRST: {
    refundable: true,
    changeAllowed: true,
    changeFee: 0,
    cancellationFeePercent: 0,
    checkedBaggagePieces: 3,
    checkedBaggageWeightKg: 32,
    carryOnPieces: 2,
    seatSelectionFee: 0,
    priorityBoarding: true,
    loungeAccess: true,
    description: 'First — fully flexible fare with all services included.',
  },
};
