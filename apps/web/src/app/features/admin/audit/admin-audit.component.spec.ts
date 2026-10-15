import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { AdminAuditPage } from './admin-audit.component';
import { AuditService, type AuditLogPage, type AuditLogItem } from './audit.service';

function item(partial: Partial<AuditLogItem>): AuditLogItem {
  return {
    id: 'id-1',
    event: 'PASSWORD_CHANGED',
    actorType: 'User',
    actorId: 'user-1',
    actorName: null,
    actorEmail: null,
    targetType: 'User',
    targetId: 'user-1',
    ipAddress: '203.0.113.5',
    createdAt: '2026-09-20T10:00:00Z',
    metadata: {},
    ...partial,
  };
}

function pageOf(items: AuditLogItem[], overrides: Partial<AuditLogPage> = {}): AuditLogPage {
  return { items, page: 1, limit: 20, total: items.length, totalPages: 1, ...overrides };
}

async function setup(listLogs: ReturnType<typeof vi.fn>) {
  await TestBed.configureTestingModule({
    imports: [AdminAuditPage],
    providers: [provideRouter([]), { provide: AuditService, useValue: { listLogs } }],
  }).compileComponents();

  const fixture = TestBed.createComponent(AdminAuditPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('AdminAuditPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('renders audit rows with readable event labels, actor fallback, record type and IP', async () => {
    const listLogs = vi
      .fn()
      .mockReturnValue(
        of(
          pageOf([
            item({}),
            item({
              id: 'id-2',
              event: 'TOKEN_REUSE_DETECTED',
              actorType: 'Guest',
              actorId: null,
              ipAddress: null,
            }),
          ]),
        ),
      );
    const fixture = await setup(listLogs);
    const el = fixture.nativeElement as HTMLElement;

    expect(listLogs).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20 }));
    expect(el.textContent).toContain('Password changed'); // not raw PASSWORD_CHANGED
    expect(el.textContent).toContain('Refresh-token reuse detected');
    expect(el.textContent).toContain('User account'); // readable target type
    expect(el.textContent).toContain('Unknown user'); // identity fallback, never a raw ID as a name
    expect(el.textContent).toContain('Guest');
    expect(el.textContent).toContain('203.0.113.5');
    expect(el.querySelectorAll('tbody tr.row').length).toBe(2);
  });

  it('shows the actor name and email when the API provides them', async () => {
    const listLogs = vi
      .fn()
      .mockReturnValue(
        of(pageOf([item({ actorName: 'Real Actor', actorEmail: 'actor@audit.test' })])),
      );
    const fixture = await setup(listLogs);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Real Actor');
    expect(el.textContent).toContain('actor@audit.test');
    expect(el.textContent).not.toContain('Unknown user');
  });

  it('shows a loading skeleton until data arrives', async () => {
    const pending = new Subject<AuditLogPage>();
    const listLogs = vi.fn().mockReturnValue(pending.asObservable());
    const fixture = await setup(listLogs);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('na-skeleton')).not.toBeNull();

    pending.next(pageOf([item({})]));
    pending.complete();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('na-skeleton')).toBeNull();
  });

  it('shows the empty state when no records match', async () => {
    const listLogs = vi.fn().mockReturnValue(of(pageOf([])));
    const fixture = await setup(listLogs);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('No audit records');
  });

  it('shows an error state and retries', async () => {
    const listLogs = vi
      .fn()
      .mockReturnValueOnce(throwError(() => ({ status: 500, message: 'x' })))
      .mockReturnValue(of(pageOf([item({})])));
    const fixture = await setup(listLogs);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.alert--danger')).not.toBeNull();
    el.querySelector<HTMLElement>('.alert__retry')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(listLogs).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('Password changed');
  });

  it('applies filters through the API (not client-side filtering)', async () => {
    const listLogs = vi.fn().mockReturnValue(of(pageOf([item({})])));
    const fixture = await setup(listLogs);
    const el = fixture.nativeElement as HTMLElement;

    const set = (id: string, value: string) => {
      const input = el.querySelector<HTMLInputElement | HTMLSelectElement>(id)!;
      input.value = value;
      input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input'));
    };
    set('#f-event', 'PASSWORD_CHANGED');
    set('#f-actor-type', 'User');
    set('#f-target', 'user-1');
    set('#f-search', '203.0.113');
    fixture.detectChanges();
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await fixture.whenStable();

    expect(listLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 1,
        event: 'PASSWORD_CHANGED',
        actorType: 'User',
        targetId: 'user-1',
        search: '203.0.113',
      }),
    );
  });

  it('paginates with next/previous through the API', async () => {
    const listLogs = vi.fn().mockReturnValue(of(pageOf([item({})], { total: 45, totalPages: 3 })));
    const fixture = await setup(listLogs);
    const el = fixture.nativeElement as HTMLElement;

    const next = [...el.querySelectorAll<HTMLElement>('.pagination na-button button')].find((b) =>
      b.textContent?.includes('Next'),
    )!;
    next.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(listLogs).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    expect(el.textContent).toContain('Page 2 of 3');
    expect(el.textContent).toContain('45 records');

    const prev = [...el.querySelectorAll<HTMLElement>('.pagination na-button button')].find((b) =>
      b.textContent?.includes('Previous'),
    )!;
    prev.click();
    await fixture.whenStable();
    expect(listLogs).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
  });

  it('expands a row to show labeled metadata rows and never renders sensitive keys', async () => {
    const listLogs = vi
      .fn()
      .mockReturnValue(
        of(
          pageOf([
            item({
              metadata: { reason: 'invalid_or_expired', changedFields: ['firstName', 'phone'] },
            }),
          ]),
        ),
      );
    const fixture = await setup(listLogs);
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLElement>('tbody tr.row')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    // Friendly labels and values, not raw JSON.
    expect(el.textContent).toContain('Reason');
    expect(el.textContent).toContain('invalid_or_expired');
    expect(el.textContent).toContain('Changed fields');
    expect(el.textContent).toContain('firstName, phone');
    expect(el.querySelector('pre')).toBeNull();
    expect(el.textContent).not.toContain('passwordHash');
    expect(el.textContent).not.toContain('refreshToken');
  });

  it('maps status metadata to readable flight-status labels', async () => {
    const listLogs = vi
      .fn()
      .mockReturnValue(
        of(
          pageOf([
            item({
              event: 'FLIGHT_STATUS_CHANGED',
              targetType: 'Flight',
              metadata: { previousStatus: 'SCHEDULED', newStatus: 'CANCELLED' },
            }),
          ]),
        ),
      );
    const fixture = await setup(listLogs);
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLElement>('tbody tr.row')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('Flight status changed');
    expect(el.textContent).toContain('Scheduled');
    expect(el.textContent).toContain('Cancelled');
    expect(el.textContent).not.toContain('SCHEDULED');
  });

  it('keeps the truncated record ID as secondary info with the full ID on the title', async () => {
    const listLogs = vi
      .fn()
      .mockReturnValue(
        of(pageOf([item({ targetType: 'Flight', targetId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })])),
      );
    const fixture = await setup(listLogs);
    const el = fixture.nativeElement as HTMLElement;

    const cell = el.querySelector<HTMLElement>('td[data-label="Affected record"]')!;
    expect(cell.textContent).toContain('Flight');
    expect(cell.textContent).toContain('f47ac10b…');
    expect(cell.title).toContain('f47ac10b-58cc-4372-a567-0e02b2c3d479');
  });

  it('keeps raw event values as filter option values while showing readable labels', async () => {
    const listLogs = vi.fn().mockReturnValue(of(pageOf([item({})])));
    const fixture = await setup(listLogs);
    const el = fixture.nativeElement as HTMLElement;

    const options = [...el.querySelectorAll<HTMLOptionElement>('#f-event option')];
    const byValue = new Map(options.map((o) => [o.value, o.textContent?.trim()]));
    expect(byValue.get('BR14_PAYMENT_EXCEPTION')).toBe('Booking confirmed without payment (exception)');
    expect(byValue.get('MFA_CHALLENGE_SENT')).toBe('MFA security code sent');

    const select = el.querySelector<HTMLSelectElement>('#f-event')!;
    select.value = 'PASSWORD_CHANGED';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(listLogs).toHaveBeenLastCalledWith(expect.objectContaining({ event: 'PASSWORD_CHANGED' }));
  });
});
