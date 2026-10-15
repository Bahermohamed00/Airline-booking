import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { NotificationBellComponent } from './notification-bell.component';
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

const pageOf = (data: CustomerNotification[]) => ({
  data,
  page: 1,
  limit: 5,
  total: data.length,
  totalPages: 1,
});

describe('NotificationBellComponent', () => {
  let fixture: ComponentFixture<NotificationBellComponent>;
  let el: HTMLElement;
  let mutationsSig: WritableSignal<number>;
  let service: {
    unreadCount: () => number;
    unreadError: () => boolean;
    unreadBadge: () => string;
    mutations: () => number;
    list: ReturnType<typeof vi.fn>;
    refreshUnreadCount: ReturnType<typeof vi.fn>;
    markRead: ReturnType<typeof vi.fn>;
    markAllRead: ReturnType<typeof vi.fn>;
  };
  let toast: { error: ReturnType<typeof vi.fn> };
  let router: Router;

  async function setup(unread = 2, unreadError = false): Promise<void> {
    mutationsSig = signal(0);
    service = {
      unreadCount: () => unread,
      unreadError: () => unreadError,
      unreadBadge: () => (unread > 99 ? '99+' : `${unread}`),
      mutations: () => mutationsSig(),
      list: vi.fn().mockReturnValue(of(pageOf([item()]))),
      refreshUnreadCount: vi.fn(),
      markRead: vi.fn().mockImplementation(() => {
        mutationsSig.update((v) => v + 1); // mirrors the service's tap() bump
        return of(item({ readAt: '2026-10-13T11:00:00.000Z' }));
      }),
      markAllRead: vi.fn(),
    };
    toast = { error: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [NotificationBellComponent],
      providers: [
        provideRouter([]),
        { provide: NotificationService, useValue: service },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(NotificationBellComponent);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('shows the unread badge and an accessible count label', async () => {
    await setup(2);
    expect(el.querySelector('.bell__badge')?.textContent?.trim()).toBe('2');
    const btn = el.querySelector<HTMLButtonElement>('.bell__btn')!;
    expect(btn.getAttribute('aria-label')).toBe('Notifications, 2 unread');
  });

  it('caps the badge at 99+', async () => {
    await setup(140);
    expect(el.querySelector('.bell__badge')?.textContent?.trim()).toBe('99+');
  });

  it('hides the badge when there is nothing unread', async () => {
    await setup(0);
    expect(el.querySelector('.bell__badge')).toBeNull();
    expect(el.querySelector('.bell__btn')!.getAttribute('aria-label')).toBe('Notifications');
  });

  it('shows an error indicator — never a silent empty badge — when the count fails to load', async () => {
    await setup(0, true);
    expect(el.querySelector('.bell__badge--error')).not.toBeNull();
    expect(el.querySelector('.bell__badge:not(.bell__badge--error)')).toBeNull();
    expect(el.querySelector('.bell__btn')!.getAttribute('aria-label')).toContain(
      'failed to load',
    );
  });

  it('loads recent notifications when opened and refreshes the count', async () => {
    await setup(2);
    el.querySelector<HTMLButtonElement>('.bell__btn')!.click();
    fixture.detectChanges();

    expect(service.list).toHaveBeenCalledWith({ page: 1, limit: 5 });
    expect(service.refreshUnreadCount).toHaveBeenCalled();
    expect(el.querySelectorAll('.bell__item')).toHaveLength(1);
    expect(el.querySelector('.bell__item--unread')).not.toBeNull();
    expect(el.querySelector('.bell__item-title')?.textContent).toContain('Booking confirmed');
  });

  it('shows the empty state when there are no notifications', async () => {
    await setup(0);
    service.list.mockReturnValue(of(pageOf([])));
    el.querySelector<HTMLButtonElement>('.bell__btn')!.click();
    fixture.detectChanges();

    expect(el.textContent).toContain("You're all caught up.");
  });

  it('shows an error state with a working retry when loading fails', async () => {
    await setup(1);
    service.list.mockReturnValueOnce(throwError(() => new Error('down')));
    el.querySelector<HTMLButtonElement>('.bell__btn')!.click();
    fixture.detectChanges();

    expect(el.textContent).toContain('Could not load notifications.');
    const retry = el.querySelector<HTMLButtonElement>('.bell__retry')!;
    service.list.mockReturnValue(of(pageOf([item()])));
    retry.click();
    fixture.detectChanges();
    expect(service.list).toHaveBeenCalledTimes(2);
    expect(el.querySelectorAll('.bell__item')).toHaveLength(1);
  });

  it('marks an unread item as read and navigates to the allowlisted booking route', async () => {
    await setup(1);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    el.querySelector<HTMLButtonElement>('.bell__btn')!.click();
    fixture.detectChanges();

    el.querySelector<HTMLButtonElement>('.bell__item')!.click();
    fixture.detectChanges();

    expect(service.markRead).toHaveBeenCalledWith('n1');
    expect(navigate).toHaveBeenCalledWith(['/bookings', 'booking-1']);
  });

  it('does not navigate for types outside the allowlist, but still marks read', async () => {
    await setup(1);
    service.list.mockReturnValue(
      of(pageOf([item({ type: 'REFUND_REVIEW_REQUIRED', bookingId: 'booking-1' })])),
    );
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    el.querySelector<HTMLButtonElement>('.bell__btn')!.click();
    fixture.detectChanges();

    el.querySelector<HTMLButtonElement>('.bell__item')!.click();

    expect(service.markRead).toHaveBeenCalledWith('n1');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('reports a failed mark-as-read instead of faking success', async () => {
    await setup(1);
    service.markRead.mockReturnValue(throwError(() => new Error('down')));
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    el.querySelector<HTMLButtonElement>('.bell__btn')!.click();
    fixture.detectChanges();

    el.querySelector<HTMLButtonElement>('.bell__item')!.click();

    expect(toast.error).toHaveBeenCalled();
  });

  it('links to the full notifications page', async () => {
    await setup(1);
    el.querySelector<HTMLButtonElement>('.bell__btn')!.click();
    fixture.detectChanges();

    const viewAll = el.querySelector<HTMLAnchorElement>('.bell__all')!;
    expect(viewAll.getAttribute('href')).toBe('/notifications');
  });

  // ---------- Cross-view synchronization ----------

  it('resyncs the open dropdown when another view mutates notifications', async () => {
    await setup(1);
    el.querySelector<HTMLButtonElement>('.bell__btn')!.click();
    fixture.detectChanges();
    expect(service.list).toHaveBeenCalledTimes(1); // initial open

    // The center page (open elsewhere) marked an item read.
    mutationsSig.update((v) => v + 1);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(service.list).toHaveBeenCalledTimes(2);
  });

  it('does not reload the dropdown for its own mark-as-read', async () => {
    await setup(1);
    vi.spyOn(router, 'navigate').mockResolvedValue(true); // booking link navigation is not under test here
    el.querySelector<HTMLButtonElement>('.bell__btn')!.click();
    fixture.detectChanges();
    service.list.mockClear();

    // Own action: markRead bumps the mutation counter (like the real service
    // tap), but the bell applied it locally — no redundant list request.
    el.querySelector<HTMLButtonElement>('.bell__item')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(service.markRead).toHaveBeenCalledWith('n1');
    expect(service.list).not.toHaveBeenCalled();
  });

  it('does not reload while closed — the next open fetches fresh data', async () => {
    await setup(1);
    el.querySelector<HTMLButtonElement>('.bell__btn')!.click(); // open
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('.bell__btn')!.click(); // close
    fixture.detectChanges();
    service.list.mockClear();

    mutationsSig.update((v) => v + 1);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(service.list).not.toHaveBeenCalled();
  });
});
