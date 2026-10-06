import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminPaymentsPage } from './admin-payments.component';
import { AdminPaymentsService } from './admin-payments.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/ui/toast.service';
import type { AdminPayment, RefundPaymentResult } from '../../../core/models/payment.model';

function payment(overrides: Partial<AdminPayment> = {}): AdminPayment {
  return {
    id: 'p1',
    bookingId: 'b1',
    bookingReference: 'NVABC1',
    bookingStatus: 'CONFIRMED',
    contactEmail: 'lena@example.com',
    amount: 498.5,
    currency: 'EUR',
    status: 'SUCCESS',
    provider: 'mockpay',
    providerReference: 'mp_abc123',
    paidAt: '2026-01-10T09:35:00Z',
    failedAt: null,
    createdAt: '2026-01-10T09:34:55Z',
    refunds: [],
    ...overrides,
  };
}

function refundResult(): RefundPaymentResult {
  return {
    refund: {
      id: 'r1',
      paymentId: 'p1',
      bookingId: 'b1',
      bookingReference: 'NVABC1',
      amount: 498.5,
      currency: 'EUR',
      status: 'PROCESSED',
      reason: null,
      processedAt: '2026-01-12T10:00:00Z',
      createdAt: '2026-01-12T10:00:00Z',
      paymentProviderReference: 'mp_abc123',
      paymentStatus: 'REFUNDED',
      contactEmail: 'lena@example.com',
    },
    payment: payment({ status: 'REFUNDED' }),
  };
}

function mocks(payments: AdminPayment[] = [payment()]) {
  return {
    api: {
      listPayments: vi.fn().mockReturnValue(of(payments)),
      getPayment: vi
        .fn()
        .mockImplementation((id: string) => of(payments.find((p) => p.id === id) ?? payment())),
      refund: vi.fn().mockReturnValue(of(refundResult())),
      listRefunds: vi.fn().mockReturnValue(of([])),
    },
    auth: { hasPermission: vi.fn().mockReturnValue(true) },
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  };
}

type Mocks = ReturnType<typeof mocks>;

async function setup(m: Mocks): Promise<ComponentFixture<AdminPaymentsPage>> {
  await TestBed.configureTestingModule({
    imports: [AdminPaymentsPage],
    providers: [
      provideRouter([]),
      { provide: AdminPaymentsService, useValue: m.api },
      { provide: AuthService, useValue: m.auth },
      { provide: ToastService, useValue: m.toast },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(AdminPaymentsPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

async function settle(fixture: ComponentFixture<AdminPaymentsPage>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

function buttonByText(root: HTMLElement | Element, text: string): HTMLButtonElement | null {
  return (
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === text,
    ) ?? null
  );
}

async function openRow(fixture: ComponentFixture<AdminPaymentsPage>): Promise<HTMLElement> {
  const el = fixture.nativeElement as HTMLElement;
  el.querySelector<HTMLElement>('tbody tr')!.click();
  await settle(fixture);
  return el;
}

describe('AdminPaymentsPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads payments from the API and renders rows', async () => {
    const m = mocks([
      payment(),
      payment({
        id: 'p2',
        bookingReference: 'NVXYZ9',
        status: 'FAILED',
        paidAt: null,
        failedAt: '2026-01-11T08:00:00Z',
      }),
    ]);
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(m.api.listPayments).toHaveBeenCalledWith({});
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    const text = el.textContent!;
    expect(text).toContain('NVABC1');
    expect(text).toContain('NVXYZ9');
    expect(text).toContain('€498.50');
    expect(text).toContain('mockpay');
    expect(text).toContain('mp_abc123');
    expect(text).toContain('Paid');
    expect(text).toContain('Failed');
    // The tokenization notice stays.
    expect(text).toContain('no raw card data is stored or displayed');
  });

  it('re-queries the API when the status filter changes', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    const select = el.querySelector<HTMLSelectElement>('#payment-status')!;
    select.value = 'SUCCESS';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(m.api.listPayments).toHaveBeenLastCalledWith({ status: 'SUCCESS' });
    expect(m.api.listPayments).toHaveBeenCalledTimes(2);
  });

  it('shows an error state with retry when the list fails to load', async () => {
    const m = mocks();
    m.api.listPayments
      .mockReturnValueOnce(throwError(() => new Error('down')))
      .mockReturnValue(of([payment()]));
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Could not load payments.');
    expect(el.querySelector('tbody tr')).toBeNull();

    el.querySelector<HTMLElement>('.list-error na-button button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.api.listPayments).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('NVABC1');
  });

  it('shows an empty state when there are no payments', async () => {
    const fixture = await setup(mocks([]));
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('No payments');
    expect(el.querySelector('tbody tr')).toBeNull();
  });

  it('opens the detail drawer with the payment facts and refunds', async () => {
    const withRefund = payment({
      refunds: [
        {
          id: 'r0',
          paymentId: 'p1',
          bookingId: 'b1',
          amount: 100,
          currency: 'EUR',
          status: 'PROCESSED',
          reason: 'Schedule change',
          processedAt: '2026-01-11T09:00:00Z',
          createdAt: '2026-01-11T08:55:00Z',
        },
      ],
    });
    const m = mocks([withRefund]);
    const fixture = await setup(m);
    const el = await openRow(fixture);

    expect(m.api.getPayment).toHaveBeenCalledWith('p1');
    const drawer = el.querySelector('.drawer')!;
    expect(drawer.getAttribute('role')).toBe('dialog');
    const text = drawer.textContent!;
    expect(text).toContain('NVABC1');
    expect(text).toContain('lena@example.com');
    expect(text).toContain('Confirmed'); // booking status badge
    expect(text).toContain('€498.50');
    expect(text).toContain('Paid'); // payment status badge
    expect(text).toContain('mockpay');
    expect(text).toContain('mp_abc123');
    expect(text).toContain('€100.00');
    expect(text).toContain('Processed');
    expect(text).toContain('Schedule change');
  });

  it('shows the refund action only with the payments:refund permission', async () => {
    const m = mocks();
    m.auth.hasPermission.mockReturnValue(false);
    const fixture = await setup(m);
    const el = await openRow(fixture);

    expect(buttonByText(el.querySelector('.drawer')!, 'Issue refund')).toBeNull();
  });

  it('hides the refund action for non-refundable payments', async () => {
    const m = mocks([payment({ status: 'FAILED' })]);
    const fixture = await setup(m);
    const el = await openRow(fixture);

    expect(buttonByText(el.querySelector('.drawer')!, 'Issue refund')).toBeNull();
  });

  it('issues a full-remainder refund, refreshes the detail and the list, and toasts', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openRow(fixture);

    buttonByText(el.querySelector('.drawer')!, 'Issue refund')!.click();
    await settle(fixture);

    const dialog = el.querySelector('na-refund-dialog na-dialog')!;
    expect(dialog.textContent).toContain('NVABC1');
    expect(dialog.textContent).toContain('498.50'); // refundable remainder

    buttonByText(dialog, 'Issue refund')!.click();
    await settle(fixture);

    // Empty amount = full refundable remainder, so no amount is sent.
    expect(m.api.refund).toHaveBeenCalledWith('p1', {});
    expect(m.toast.success).toHaveBeenCalledOnce();
    // Detail shows the refunded payment; the list re-queries.
    expect(m.api.listPayments).toHaveBeenCalledTimes(2);
    expect(el.querySelector('.drawer')!.textContent).toContain('Refunded');
  });

  it('surfaces a displayable 409 message when the refund is rejected', async () => {
    const m = mocks();
    m.api.refund.mockReturnValue(
      throwError(() => ({ status: 409, error: { message: 'Payment is already fully refunded.' } })),
    );
    const fixture = await setup(m);
    const el = await openRow(fixture);

    buttonByText(el.querySelector('.drawer')!, 'Issue refund')!.click();
    await settle(fixture);
    const dialog = el.querySelector('na-refund-dialog na-dialog')!;
    buttonByText(dialog, 'Issue refund')!.click();
    await settle(fixture);

    expect(m.toast.error).toHaveBeenCalledWith('Payment is already fully refunded.');
    expect(m.toast.success).not.toHaveBeenCalled();
  });
});
