import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminCancellationRequestsPage } from './admin-cancellation-requests.component';
import {
  CancellationRequestsService,
  type AdminCancellationRequest,
} from '../../../core/services/cancellation-requests.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/ui/toast.service';
import { formatMoney } from '../../../core/services/pricing.service';

function request(partial: Partial<AdminCancellationRequest> = {}): AdminCancellationRequest {
  return {
    id: 'cr-1',
    status: 'PENDING',
    reason: 'Plans changed',
    requestedAt: '2026-10-01T09:00:00Z',
    reviewedAt: null,
    rejectionReason: null,
    booking: {
      id: 'b1',
      bookingReference: 'NVA7K2',
      status: 'CONFIRMED',
      totalAmount: 289.5,
      currency: 'EUR',
      bookedAt: '2026-09-20T10:15:00Z',
    },
    customer: { firstName: 'Aya', lastName: 'Mansour', email: 'aya@example.com' },
    flight: {
      flightNumber: 'LH101',
      originIata: 'FRA',
      destinationIata: 'LHR',
      departureTime: '2027-01-10T09:30:00Z',
    },
    payment: { amount: 289.5, currency: 'EUR', status: 'SUCCESS' },
    policy: { refundPercentage: 80, refundableAmount: 231.6, currency: 'EUR' },
    refund: null,
    ...partial,
  };
}

function mocks(list: AdminCancellationRequest[] = [request()]) {
  return {
    requests: {
      list: vi.fn().mockReturnValue(of(list)),
      approve: vi.fn().mockReturnValue(of(request({ status: 'APPROVED' }))),
      reject: vi.fn().mockReturnValue(of(request({ status: 'REJECTED' }))),
    },
    auth: { hasPermission: vi.fn().mockReturnValue(true) },
    toast: { success: vi.fn(), error: vi.fn() },
  };
}

type Mocks = ReturnType<typeof mocks>;

async function setup(m: Mocks): Promise<ComponentFixture<AdminCancellationRequestsPage>> {
  await TestBed.configureTestingModule({
    imports: [AdminCancellationRequestsPage],
    providers: [
      provideRouter([]),
      { provide: CancellationRequestsService, useValue: m.requests },
      { provide: AuthService, useValue: m.auth },
      { provide: ToastService, useValue: m.toast },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(AdminCancellationRequestsPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

async function settle(
  fixture: ComponentFixture<AdminCancellationRequestsPage>,
): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

function buttonByText(el: HTMLElement | Element, text: string): HTMLButtonElement | null {
  return (
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === text,
    ) ?? null
  );
}

function dialogByTitle(el: HTMLElement, title: string): HTMLElement {
  const dialog = el.querySelector<HTMLElement>(`na-dialog[title="${title}"]`);
  if (!dialog) throw new Error(`dialog "${title}" not found`);
  return dialog;
}

function setFilter(el: HTMLElement, value: string): void {
  const select = el.querySelector<HTMLSelectElement>('#status-filter')!;
  select.value = value;
  select.dispatchEvent(new Event('change'));
}

describe('AdminCancellationRequestsPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('lists PENDING requests by default with booking, customer, flight, policy and status', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(m.requests.list).toHaveBeenCalledWith('PENDING');
    expect(el.textContent).toContain('NVA7K2');
    expect(el.textContent).toContain('Aya Mansour');
    expect(el.textContent).toContain('aya@example.com');
    expect(el.textContent).toContain('FRA → LHR');
    expect(el.textContent).toContain('LH101');
    expect(el.textContent).toContain('Plans changed');
    expect(el.textContent).toContain('80%');
    expect(el.textContent).toContain(formatMoney(231.6, 'EUR'));
    expect(el.textContent).toContain('PENDING');
    expect(buttonByText(el, 'Approve')).not.toBeNull();
    expect(buttonByText(el, 'Reject')).not.toBeNull();
  });

  it('reloads without a status param when the filter is set to All', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    setFilter(el, '');
    await settle(fixture);

    expect(m.requests.list).toHaveBeenLastCalledWith(undefined);

    setFilter(el, 'APPROVED');
    await settle(fixture);
    expect(m.requests.list).toHaveBeenLastCalledWith('APPROVED');
  });

  it('requires the bookings:manage permission and never calls the API without it', async () => {
    const m = mocks();
    m.auth.hasPermission.mockReturnValue(false);
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Access restricted');
    expect(m.requests.list).not.toHaveBeenCalled();
  });

  it('approves a PENDING request after a confirmation that names the refundable amount', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    buttonByText(el, 'Approve')!.click();
    await settle(fixture);

    const dialog = dialogByTitle(el, 'Approve cancellation request?');
    expect(dialog.textContent).toContain(
      `Approving will refund ${formatMoney(231.6, 'EUR')}`,
    );
    expect(dialog.textContent).toContain('cancel booking');
    expect(dialog.textContent).toContain('once the refund completes');

    buttonByText(dialog, 'Approve request')!.click();
    await settle(fixture);

    expect(m.requests.approve).toHaveBeenCalledWith('cr-1');
    expect(m.toast.success).toHaveBeenCalledWith(
      `Cancellation approved — refund of ${formatMoney(231.6, 'EUR')} initiated.`,
    );
    expect(m.requests.list).toHaveBeenCalledTimes(2); // refreshed
  });

  it('rejects a PENDING request with the entered rejection reason', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    buttonByText(el, 'Reject')!.click();
    await settle(fixture);

    const dialog = dialogByTitle(el, 'Reject cancellation request?');
    const textarea = dialog.querySelector<HTMLTextAreaElement>('#reject-reason')!;
    textarea.value = 'Fare rules do not allow a refund after check-in.';
    textarea.dispatchEvent(new Event('input'));
    await settle(fixture);

    buttonByText(dialog, 'Reject request')!.click();
    await settle(fixture);

    expect(m.requests.reject).toHaveBeenCalledWith(
      'cr-1',
      'Fare rules do not allow a refund after check-in.',
    );
    expect(m.toast.success).toHaveBeenCalledWith('Cancellation request rejected.');
    expect(m.requests.list).toHaveBeenCalledTimes(2);
  });

  it('rejects without a reason body when the field is left empty', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    buttonByText(el, 'Reject')!.click();
    await settle(fixture);
    const dialog = dialogByTitle(el, 'Reject cancellation request?');
    buttonByText(dialog, 'Reject request')!.click();
    await settle(fixture);

    expect(m.requests.reject).toHaveBeenCalledWith('cr-1', undefined);
  });

  it('handles 409 on approve as "already reviewed" and refreshes the list', async () => {
    const m = mocks();
    m.requests.approve.mockReturnValue(
      throwError(() => ({ status: 409, error: { message: 'Already reviewed' } })),
    );
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    buttonByText(el, 'Approve')!.click();
    await settle(fixture);
    buttonByText(dialogByTitle(el, 'Approve cancellation request?'), 'Approve request')!.click();
    await settle(fixture);

    expect(m.toast.error).toHaveBeenCalledWith(
      'This request was already reviewed. The list has been refreshed.',
    );
    expect(m.requests.list).toHaveBeenCalledTimes(2);
  });

  it('handles 409 on reject as "already reviewed" and refreshes the list', async () => {
    const m = mocks();
    m.requests.reject.mockReturnValue(
      throwError(() => ({ status: 409, error: { message: 'Already reviewed' } })),
    );
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    buttonByText(el, 'Reject')!.click();
    await settle(fixture);
    buttonByText(dialogByTitle(el, 'Reject cancellation request?'), 'Reject request')!.click();
    await settle(fixture);

    expect(m.toast.error).toHaveBeenCalledWith(
      'This request was already reviewed. The list has been refreshed.',
    );
    expect(m.requests.list).toHaveBeenCalledTimes(2);
  });

  it('shows the linked refund status on APPROVED rows and no review actions', async () => {
    const m = mocks([
      request({
        id: 'cr-2',
        status: 'APPROVED',
        reviewedAt: '2026-10-02T08:00:00Z',
        refund: { id: 'r1', status: 'PROCESSED', amount: 231.6 },
      }),
    ]);
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Processed');
    expect(el.textContent).toContain('APPROVED');
    expect(buttonByText(el, 'Approve')).toBeNull();
    expect(buttonByText(el, 'Reject')).toBeNull();
  });

  it('offers "Approve again" on an APPROVED request whose refund was REJECTED', async () => {
    const m = mocks([
      request({
        id: 'cr-3',
        status: 'APPROVED',
        reviewedAt: '2026-10-02T08:00:00Z',
        refund: { id: 'r1', status: 'REJECTED', amount: 231.6 },
      }),
    ]);
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Rejected');
    expect(el.textContent).toContain('approve again to retry');

    buttonByText(el, 'Approve again')!.click();
    await settle(fixture);
    buttonByText(dialogByTitle(el, 'Approve cancellation request?'), 'Approve request')!.click();
    await settle(fixture);

    expect(m.requests.approve).toHaveBeenCalledWith('cr-3');
  });

  it('shows a retryable error state when the list fails to load', async () => {
    const m = mocks();
    m.requests.list.mockReturnValue(throwError(() => ({ status: 500 })));
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Could not load cancellation requests.');
    expect(buttonByText(el, 'Retry')).not.toBeNull();
  });
});
