import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminRefundsPage } from './admin-refunds.component';
import { AdminPaymentsService } from './admin-payments.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/ui/toast.service';
import type { AdminPayment, AdminRefund, RefundPaymentResult } from '../../../core/models/payment.model';

function refund(overrides: Partial<AdminRefund> = {}): AdminRefund {
  return {
    id: 'r1',
    paymentId: 'p1',
    bookingId: 'b1',
    bookingReference: 'NVABC1',
    amount: 100,
    currency: 'EUR',
    status: 'PROCESSED',
    reason: 'Schedule change',
    processedAt: '2026-01-11T09:00:00Z',
    createdAt: '2026-01-11T08:55:00Z',
    paymentProviderReference: 'mp_abc123',
    paymentStatus: 'PARTIALLY_REFUNDED',
    contactEmail: 'lena@example.com',
    ...overrides,
  };
}

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

function mocks(refunds: AdminRefund[] = [refund()]) {
  return {
    api: {
      listRefunds: vi.fn().mockReturnValue(of(refunds)),
      listPayments: vi.fn().mockReturnValue(
        of([payment(), payment({ id: 'p2', bookingReference: 'NVXYZ9', status: 'FAILED' })]),
      ),
      refund: vi.fn().mockReturnValue(
        of({
          refund: refund(),
          payment: payment({ status: 'PARTIALLY_REFUNDED' }),
        } satisfies RefundPaymentResult),
      ),
      getPayment: vi.fn(),
    },
    auth: { hasPermission: vi.fn().mockReturnValue(true) },
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  };
}

type Mocks = ReturnType<typeof mocks>;

async function setup(m: Mocks): Promise<ComponentFixture<AdminRefundsPage>> {
  await TestBed.configureTestingModule({
    imports: [AdminRefundsPage],
    providers: [
      provideRouter([]),
      { provide: AdminPaymentsService, useValue: m.api },
      { provide: AuthService, useValue: m.auth },
      { provide: ToastService, useValue: m.toast },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(AdminRefundsPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

async function settle(fixture: ComponentFixture<AdminRefundsPage>): Promise<void> {
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

describe('AdminRefundsPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads refunds from the API and renders rows', async () => {
    const m = mocks([refund(), refund({ id: 'r2', bookingReference: 'NVXYZ9', reason: null })]);
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(m.api.listRefunds).toHaveBeenCalledWith({});
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    const text = el.textContent!;
    expect(text).toContain('NVABC1');
    expect(text).toContain('€100.00');
    expect(text).toContain('Schedule change');
    expect(text).toContain('lena@example.com');
    expect(text).toContain('Processed');
    // No approval queue: refunds are processed instantly.
    expect(buttonByText(el, 'Approve')).toBeNull();
    expect(buttonByText(el, 'Reject')).toBeNull();
  });

  it('re-queries the API when the status filter changes', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    const select = el.querySelector<HTMLSelectElement>('#refund-status')!;
    select.value = 'PROCESSED';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(m.api.listRefunds).toHaveBeenLastCalledWith({ status: 'PROCESSED' });
  });

  it('shows an error state with retry when the list fails to load', async () => {
    const m = mocks();
    m.api.listRefunds
      .mockReturnValueOnce(throwError(() => new Error('down')))
      .mockReturnValue(of([refund()]));
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Could not load refunds.');

    el.querySelector<HTMLElement>('.list-error na-button button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.api.listRefunds).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('NVABC1');
  });

  it('shows an empty state when there are no refunds', async () => {
    const fixture = await setup(mocks([]));
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('No refunds');
    expect(el.querySelector('tbody tr')).toBeNull();
  });

  it('gates the Issue refund action behind the payments:refund permission', async () => {
    const m = mocks();
    m.auth.hasPermission.mockReturnValue(false);
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(buttonByText(el, 'Issue refund')).toBeNull();
  });

  it('issues a refund for a picked payment, toasts and refreshes the list', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    buttonByText(el, 'Issue refund')!.click();
    await settle(fixture);

    expect(m.api.listPayments).toHaveBeenCalledWith({});
    const dialog = el.querySelector('na-refund-dialog na-dialog')!;
    const picker = dialog.querySelector<HTMLSelectElement>('#refund-payment')!;
    // Only refundable payments are offered (the FAILED one is excluded).
    const options = Array.from(picker.querySelectorAll('option')).map((o) => o.textContent ?? '');
    expect(options.some((o) => o.includes('NVABC1'))).toBe(true);
    expect(options.some((o) => o.includes('NVXYZ9'))).toBe(false);

    picker.value = 'p1';
    picker.dispatchEvent(new Event('change'));
    await settle(fixture);

    buttonByText(dialog, 'Issue refund')!.click();
    await settle(fixture);

    expect(m.api.refund).toHaveBeenCalledWith('p1', {});
    expect(m.toast.success).toHaveBeenCalledOnce();
    expect(m.api.listRefunds).toHaveBeenCalledTimes(2);
  });

  it('shows the displayable 409 message when the refund is rejected', async () => {
    const m = mocks();
    m.api.refund.mockReturnValue(
      throwError(() => ({ status: 409, error: { message: 'Amount exceeds the refundable remainder.' } })),
    );
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    buttonByText(el, 'Issue refund')!.click();
    await settle(fixture);
    const picker = el.querySelector<HTMLSelectElement>('#refund-payment')!;
    picker.value = 'p1';
    picker.dispatchEvent(new Event('change'));
    await settle(fixture);
    buttonByText(el.querySelector('na-refund-dialog na-dialog')!, 'Issue refund')!.click();
    await settle(fixture);

    expect(m.toast.error).toHaveBeenCalledWith('Amount exceeds the refundable remainder.');
    expect(m.toast.success).not.toHaveBeenCalled();
    expect(m.api.listRefunds).toHaveBeenCalledTimes(1);
  });
});
