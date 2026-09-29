/**
 * Timezone helpers for airport-local schedule math. Implemented on Intl (no
 * external date library): offset lookups are computed per instant, so DST
 * transitions are handled correctly.
 */

function zoneParts(timeZone: string, at: Date): Record<string, number> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const out: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return out;
}

/** Offset of an IANA zone in minutes east of UTC at a given instant. */
export function zoneOffsetMinutes(timeZone: string, at: Date): number {
  const p = zoneParts(timeZone, at);
  const asUtc = Date.UTC(p['year'], p['month'] - 1, p['day'], p['hour'], p['minute'], p['second']);
  return Math.round((asUtc - at.getTime()) / 60000);
}

/**
 * UTC instant for a wall-clock time ("HH:mm") on a calendar date
 * ("yyyy-mm-dd") in an IANA zone. Iterating the offset lookup converges even
 * around DST transitions.
 */
export function zonedTimeToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  let utc = Date.UTC(y!, m! - 1, d!, hh!, mm!);
  for (let i = 0; i < 3; i++) {
    const next = Date.UTC(y!, m! - 1, d!, hh!, mm!) - zoneOffsetMinutes(timeZone, new Date(utc)) * 60000;
    if (next === utc) break;
    utc = next;
  }
  return new Date(utc);
}

/** Calendar date ("yyyy-mm-dd") of an instant as seen in an IANA zone. */
export function formatDateInZone(instant: Date, timeZone: string): string {
  const p = zoneParts(timeZone, instant);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p['year']}-${pad(p['month'])}-${pad(p['day'])}`;
}
