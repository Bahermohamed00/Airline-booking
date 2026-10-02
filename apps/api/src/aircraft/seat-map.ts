import { CabinClass } from '@prisma/client';

export interface SeatDraft {
  seatNumber: string;
  cabinClass: CabinClass;
  seatRow: number;
  seatColumn: string;
  isExitRow: boolean;
}

export const SEAT_COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
export const EXIT_ROWS = [12, 25] as const;

/**
 * Deterministic NovaAir seat map: 6 columns A–F, FIRST for rows ≤2 on
 * wide-bodies (capacity ≥ 300), BUSINESS for rows ≤6 on capacity ≥ 220,
 * ECONOMY otherwise; rows 12 and 25 are exit rows. Single source of truth —
 * shared by the API (admin-created aircraft) and prisma/seed.ts.
 */
export function generateSeatMap(capacity: number): SeatDraft[] {
  const seats: SeatDraft[] = [];
  const totalRows = Math.ceil(capacity / SEAT_COLUMNS.length);
  let count = 0;
  for (let row = 1; row <= totalRows && count < capacity; row++) {
    for (const column of SEAT_COLUMNS) {
      if (count >= capacity) break;
      seats.push({
        seatNumber: `${row}${column}`,
        cabinClass:
          row <= 2 && capacity >= 300
            ? CabinClass.FIRST
            : row <= 6 && capacity >= 220
              ? CabinClass.BUSINESS
              : CabinClass.ECONOMY,
        seatRow: row,
        seatColumn: column,
        isExitRow: (EXIT_ROWS as readonly number[]).includes(row),
      });
      count++;
    }
  }
  return seats;
}
