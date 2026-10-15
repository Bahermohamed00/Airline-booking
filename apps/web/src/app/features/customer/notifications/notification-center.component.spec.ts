import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Component, signal, type WritableSignal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import { NotificationCenterPage } from './notification-center.component';
import { NotificationService } from '../../../core/services/notification.service';
import { ToastService } from '../../../shared/ui/toast.service';
import type { CustomerNotification } from '../../../core/services/notification.service';

const item = (overrides: Partial<CustomerNotification> = {}): CustomerNotification => ({
  id: 'n1',
  type: 'BOOKING_CONFIRMED',
  title: 'Booking confirmed',
  content: 'Your booking NVAB12 is confirmed.',
  bookingId: 'booking-1',
  readAt: null,
  createdAt: '2026-10-13T10:00:00.000Z',
  ...overrides,
});

const readItem = item({ id: 'n2', type: 'PAYMENT_SUCCEEDED', readAt: '2026-10-13T09:00:00.000Z' });

const pageOf = (
  data: CustomerNotification[],
  overrides: Record<string, unknown> = {},
) => ({ data, page: 1, limit: 20, total: data.length, totalPages: 1, ...overrides });

describe('NotificationCenterPage', () => {
  let fixture: ComponentFixture<NotificationCenterPage>;
  let el: HTMLElement;
  let mutationsSig: WritableSignal<number>;
  let service: {
    unreadCount: () => number;
    unreadBadge: () => string;
    mutations: () => number;
    list: ReturnType<typeof vi.fn>;
    refreshUnreadCount: ReturnType<typeof vi.fn>;
    markRead: ReturnType<typeof vi.fn>;
    markAllRead: ReturnType<typeof vi.fn>;
  };
  let toast: { error: ReturnType<typeof vi.fn> };

  async function setup(unread = 1): Promise<void> {
    mutationsSig = signal(0);
    service = {
      unreadCount: () => unread,
      unreadBadge: () => `${unread}`,
      mutations: () => mutationsSig(),
      list: vi.fn().mockReturnValue(of(pageOf([item(), readItem]))),
      refreshUnreadCount: vi.fn(),
      markRead: vi.fn().mockImplementation(() => {
        mutationsSig.update((v) => v + 1); // mirrors the service's tap() bump
        return of(item({ readAt: '2026-10-13T11:00:00.000Z' }));
      }),
      markAllRead: vi.fn().mockImplementation(() => {
        mutationsSig.update((v) => v + 1);
        return of({ updated: 1 });
      }),
    };
    toast = { error: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [NotificationCenterPage],
      providers: [
        provideRouter([]),
        { provide: NotificationService, useValue: service },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(NotificationCenterPage);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('shows a loading state until the list arrives', async () => {
    await setup();
    service.list.mockReturnValue(new Observable(() => undefined));
    fixture.componentInstance.load();
    fixture.detectChanges();

    expect(el.querySelector('.inbox__status')?.textContent).toContain('Loading notifications');
    expect(el.querySelectorAll('.inbox__skeleton').length).toBeGreaterThan(0);
  });

  it('renders the page newest-first with read/unread treatment and a booking link', async () => {
    await setup();

    const items = el.querySelectorAll('.inbox__item');
    expect(items).toHaveLength(2);
    expect(items[0]!.classList.contains('inbox__item--unread')).toBe(true);
    expect(items[1]!.classList.contains('inbox__item--unread')).toBe(false);
    expect(el.textContent).toContain('1 unread');

    const link = items[0]!.querySelector<HTMLAnchorElement>('.inbox__action--link')!;
    expect(link.getAttribute('href')).toBe('/bookings/booking-1');
  });

  it('omits the booking link for unsupported types', async () => {
    await setup();
    service.list.mockReturnValue(of(pageOf([item({ type: 'OFFER_PUBLISHED' })])));
    fixture.componentInstance.load();
    fixture.detectChanges();

    expect(el.querySelector('.inbox__action--link')).toBeNull();
  });

  it('marks one item as read and updates the list', async () => {
    await setup();
    const markBtn = el.querySelector<HTMLButtonElement>(
      '.inbox__item--unread button.inbox__action',
    )!;
    markBtn.click();
    fixture.detectChanges();

    expect(service.markRead).toHaveBeenCalledWith('n1');
    expect(el.querySelectorAll('.inbox__item--unread')).toHaveLength(0);
  });

  it('keeps the item unread and reports the error when mark-as-read fails', async () => {
    await setup();
    service.markRead.mockReturnValue(throwError(() => new Error('down')));
    el.querySelector<HTMLButtonElement>('.inbox__item--unread button.inbox__action')!.click();
    fixture.detectChanges();

    expect(toast.error).toHaveBeenCalled();
    expect(el.querySelectorAll('.inbox__item--unread')).toHaveLength(1);
  });

  it('marks all as read and reloads from the server', async () => {
    await setup();
    service.list.mockClear();
    el.querySelector<HTMLButtonElement>('.inbox__mark-all')!.click();
    fixture.detectChanges();

    expect(service.markAllRead).toHaveBeenCalled();
    expect(service.list).toHaveBeenCalledTimes(1); // reload after success
  });

  it('reports a failed mark-all instead of faking success', async () => {
    await setup();
    service.markAllRead.mockReturnValue(throwError(() => new Error('down')));
    service.list.mockClear();
    el.querySelector<HTMLButtonElement>('.inbox__mark-all')!.click();
    fixture.detectChanges();

    expect(toast.error).toHaveBeenCalled();
    expect(service.list).not.toHaveBeenCalled();
  });

  it('disables mark-all when there is nothing unread', async () => {
    await setup(0);
    const btn = el.querySelector<HTMLButtonElement>('.inbox__mark-all')!;
    expect(btn.disabled).toBe(true);
  });

  it('switches to the unread filter with a backend status param', async () => {
    await setup();
    service.list.mockClear();
    const unreadBtn = Array.from(
      el.querySelectorAll<HTMLButtonElement>('.inbox__filter'),
    ).find((b) => b.textContent?.trim() === 'Unread')!;
    unreadBtn.click();

    expect(service.list).toHaveBeenCalledWith({ page: 1, limit: 20, status: 'unread' });
  });

  it('paginates with bounded requests', async () => {
    await setup();
    service.list.mockReturnValue(of(pageOf([item()], { totalPages: 3, total: 55 })));
    fixture.componentInstance.load();
    fixture.detectChanges();
    service.list.mockClear();

    const next = Array.from(
      el.querySelectorAll<HTMLButtonElement>('.inbox__page-btn'),
    ).find((b) => b.textContent?.trim() === 'Next')!;
    next.click();
    fixture.detectChanges();

    expect(service.list).toHaveBeenCalledWith({ page: 2, limit: 20, status: undefined });
    expect(el.textContent).toContain('Page 2 of 3');
  });

  it('shows an error state with retry and an empty state', async () => {
    await setup();
    service.list.mockReturnValueOnce(throwError(() => new Error('down')));
    fixture.componentInstance.load();
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not load notifications.',
    );

    service.list.mockReturnValue(of(pageOf([])));
    el.querySelector<HTMLButtonElement>('.inbox__retry')!.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('No notifications yet.');
  });

  // ---------- Cross-view synchronization ----------

  it('reloads when another view mutates notifications while this page is open', async () => {
    await setup();
    expect(service.list).toHaveBeenCalledTimes(1); // initial load

    // Simulate the bell dropdown marking an item read elsewhere in the app.
    mutationsSig.update((v) => v + 1);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(service.list).toHaveBeenCalledTimes(2);
  });

  it('does not reload redundantly for mutations this page originated', async () => {
    await setup();
    service.list.mockClear();

    // Own mark-as-read: the local update path applies the change; the
    // reconciliation effect must not issue a second list request.
    el.querySelector<HTMLButtonElement>('.inbox__item--unread button.inbox__action')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(service.markRead).toHaveBeenCalledWith('n1');
    expect(service.list).not.toHaveBeenCalled();
  });

  it('refreshes when navigating to /notifications again while the page is alive', async () => {
    await setup(); // creates the mocked service (and an initial component)
    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [NotificationCenterPage],
      providers: [
        provideRouter([
          { path: 'notifications', component: DummyRoute },
          { path: '**', component: DummyRoute },
        ]),
        { provide: NotificationService, useValue: service },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(NotificationCenterPage);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();

    service.list.mockClear();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/somewhere-else');
    expect(service.list).not.toHaveBeenCalled(); // unrelated navigation: no reload here
    await router.navigateByUrl('/notifications');
    expect(service.list).toHaveBeenCalledTimes(1);
  });
});

@Component({ template: '' })
class DummyRoute {}
