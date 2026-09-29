import { describe, it, expect } from 'vitest';
import {
  FLIGHT_STATUS_MAP,
  BOOKING_STATUS_MAP,
  PAYMENT_STATUS_MAP,
  BAGGAGE_STATUS_MAP,
  statusLabel,
} from './status-maps';

describe('status maps', () => {
  it('maps every flight status to a label and tone', () => {
    expect(FLIGHT_STATUS_MAP.DELAYED).toEqual({ label: 'Delayed', tone: 'warning' });
    expect(FLIGHT_STATUS_MAP.CANCELLED.tone).toBe('danger');
    expect(FLIGHT_STATUS_MAP.COMPLETED.tone).toBe('success');
  });

  it('maps booking and payment statuses semantically', () => {
    expect(BOOKING_STATUS_MAP.PENDING.tone).toBe('warning');
    expect(BOOKING_STATUS_MAP.CONFIRMED.tone).toBe('success');
    expect(PAYMENT_STATUS_MAP.FAILED.tone).toBe('danger');
  });

  it('maps baggage exception states to warning/danger', () => {
    expect(BAGGAGE_STATUS_MAP.DELAYED.tone).toBe('warning');
    expect(BAGGAGE_STATUS_MAP.LOST.tone).toBe('danger');
    expect(BAGGAGE_STATUS_MAP.DELIVERED.tone).toBe('success');
  });

  it('falls back to a neutral presentation for unknown keys', () => {
    expect(statusLabel(FLIGHT_STATUS_MAP, 'UNKNOWN_VALUE')).toEqual({
      label: 'UNKNOWN_VALUE',
      tone: 'neutral',
    });
  });
});
