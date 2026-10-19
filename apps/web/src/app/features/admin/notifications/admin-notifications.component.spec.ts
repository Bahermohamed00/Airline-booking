import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { AdminNotificationsPage } from './admin-notifications.component';
import { AdminNotificationsService } from './admin-notifications.service';
import type { AdminNotificationItem } from './admin-notifications.service';

const item = (overrides: Partial<AdminNotificationItem> = {}): AdminNotificationItem => ({
  id: 'n1',
  type: 'BOOKING_CONFIRMED',
  channel: 'EMAIL',
  status: 'SENT',
  title: 'Booking confirmed',
  content: 'Your booking NVAB12 is confirmed.',
  userId: 'user-1',
  bookingId: 'booking-1',
  readAt: null,
  attempts: 1,
  error: null,
  sentAt: '2026-10-13T10:00:00.000Z',
  createdAt: '2026-10-13T10:00:00.000Z',
  ...overrides,
});

const pageOf = (data: AdminNotificationItem[], overrides: Record<string, unknown> = {}) => ({
  data,
  page: 1,
  limit: 20,
  total: data.length,
  totalPages: 1,
  ...overrides,
});

describe('AdminNotificationsPage', () => {
  let fixture: ComponentFixture<AdminNotificationsPage>;
  let el: HTMLElement;
  let api: { list: ReturnType<typeof vi.fn> };

  async function setup(): Promise<void> {
    api = { list: vi.fn().mockReturnValue(of(pageOf([item()]))) };
    await TestBed.configureTestingModule({
      imports: [AdminNotificationsPage],
      providers: [
        provideRouter([]),
        { provide: AdminNotificationsService, useValue: api },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminNotificationsPage);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('renders real API rows with title (never the mock subject) and sent time', async () => {
    await setup();
    expect(api.list).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      channel: undefined,
      status: undefined,
      read: undefined,
    });
    expect(el.textContent).toContain('Booking confirmed');
    expect(el.textContent).toContain('SENT'.toLowerCase().replace(/^./, (c) => c.toUpperCase()));
    expect(el.querySelector('table')).not.toBeNull();
  });

  it('shows a loading skeleton until the response arrives', async () => {
    api = { list: vi.fn().mockReturnValue(new Observable(() => undefined)) };
    await TestBed.configureTestingModule({
      imports: [AdminNotificationsPage],
      providers: [provideRouter([]), { provide: AdminNotificationsService, useValue: api }],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminNotificationsPage);
    el = fixture.nativeElement;
    fixture.detectChanges();

    expect(fixture.componentInstance.loading()).toBe(true);
  });

  it('shows the empty state only for a genuinely empty result', async () => {
    await setup();
    api.list.mockReturnValue(of(pageOf([])));
    fixture.componentInstance.load();
    fixture.detectChanges();

    expect(el.textContent).toContain('No notifications');
  });

  it('shows a retryable error state on failure — never a fake empty list', async () => {
    await setup();
    api.list.mockReturnValue(throwError(() => ({ status: 500 })));
    fixture.componentInstance.load();
    fixture.detectChanges();

    expect(el.textContent).toContain('Could not load notifications.');
    expect(el.textContent).not.toContain('No notifications');

    api.list.mockReturnValue(of(pageOf([item()])));
    const retry = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Retry',
    )!;
    retry.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Booking confirmed');
  });

  it('shows a permission-specific message on 403', async () => {
    await setup();
    api.list.mockReturnValue(throwError(() => ({ status: 403 })));
    fixture.componentInstance.load();
    fixture.detectChanges();

    expect(el.textContent).toContain('You do not have permission');
  });

  it('applies filters through the API and resets to page 1', async () => {
    await setup();
    api.list.mockClear();

    const selects = el.querySelectorAll<HTMLSelectElement>('select.na-select');
    const channelSelect = selects[0]!;
    channelSelect.value = 'EMAIL';
    channelSelect.dispatchEvent(new Event('change'));

    expect(api.list).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      channel: 'EMAIL',
      status: undefined,
      read: undefined,
    });
  });

  it('paginates via the API', async () => {
    await setup();
    api.list.mockReturnValue(of(pageOf([item()], { totalPages: 3, total: 55 })));
    fixture.componentInstance.load();
    fixture.detectChanges();
    api.list.mockClear();

    const next = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Next',
    )!;
    next.click();

    expect(api.list).toHaveBeenCalledWith({
      page: 2,
      limit: 20,
      channel: undefined,
      status: undefined,
      read: undefined,
    });
  });

  it('discards a stale response when a newer request supersedes it', async () => {
    await setup();
    let first!: (v: unknown) => void;
    api.list.mockImplementationOnce(
      () =>
        new Observable((sub) => {
          first = (v) => {
            sub.next(v);
            sub.complete();
          };
        }),
    );
    fixture.componentInstance.load();
    api.list.mockReturnValue(of(pageOf([item({ title: 'fresh' })])));
    fixture.componentInstance.load();

    first(pageOf([item({ title: 'stale' })]));
    fixture.detectChanges();

    expect(el.textContent).toContain('fresh');
    expect(el.textContent).not.toContain('stale');
  });

  it('has no send-notification action (backend is read-only)', async () => {
    await setup();
    expect(el.textContent).not.toContain('Send notification');
    expect(el.textContent).not.toContain('Queue notification');
    expect((fixture.componentInstance as unknown as Record<string, unknown>)['send']).toBeUndefined();
  });
});
