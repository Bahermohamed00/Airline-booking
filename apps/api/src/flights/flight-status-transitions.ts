import { FlightStatus } from '@prisma/client';

/**
 * Flight lifecycle transition map. `status` owns the lifecycle
 * (SCHEDULED → BOARDING → DEPARTED → ARRIVED → COMPLETED, CANCELLED terminal);
 * `scheduleStatus` keeps its separate ONTIME/DELAYED meaning.
 *
 * ACTIVE/DELAYED are pre-lifecycle values kept for backward compatibility with
 * existing rows. They have no defined transitions (terminal here) until a data
 * migration maps them onto the lifecycle — tracked as a follow-up.
 */
export const FLIGHT_STATUS_TRANSITIONS: Readonly<Record<FlightStatus, readonly FlightStatus[]>> = {
  SCHEDULED: ['BOARDING', 'CANCELLED'],
  BOARDING: ['DEPARTED', 'CANCELLED'],
  DEPARTED: ['ARRIVED'],
  ARRIVED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  ACTIVE: [],
  DELAYED: [],
};

export function isFlightTransitionAllowed(from: FlightStatus, to: FlightStatus): boolean {
  return FLIGHT_STATUS_TRANSITIONS[from].includes(to);
}
