import { randomInt } from 'node:crypto';

/**
 * Human-readable support ticket reference: "NT" + 6 characters from the same
 * unambiguous alphabet as booking references (no I/O/0/1). Generated
 * server-side only; uniqueness is enforced by the
 * support_tickets.ticket_number unique constraint (with retry on collision).
 */
export const TICKET_NUMBER_PATTERN = /^NT[A-Z0-9]{6}$/;

const PREFIX = 'NT';
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateTicketNumber(): string {
  let reference = PREFIX;
  for (let i = 0; i < 6; i++) {
    reference += CHARSET[randomInt(CHARSET.length)];
  }
  return reference;
}
