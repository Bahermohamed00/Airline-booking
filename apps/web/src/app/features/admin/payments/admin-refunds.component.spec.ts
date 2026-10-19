import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminRefundsPage } from './admin-refunds.component';
import { AdminPaymentsService } from './admin-payments.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/ui/toast.service';
import type {
  AdminPayment,
  AdminRefund,
  AdminRefundListResult,
  OrphanProviderRefund,
  OrphanRefundListResult,
  RefundOperations,
  RefundPaymentResult,
  ResumeRefundResult,
} from '../../../core/models/payment.model';

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
    updatedAt: '2026-01-11T09:00:00Z',
    paymentProviderReference: 'mp_abc123',
    paymentStatus: 'PARTIALLY_REFUNDED',
    contactEmail: 'lena@example.com',
    providerReference: 're_123',
    pendingAgeMinutes: null,
    pendingRecovery: false,
    recoveryKey: 'refund-r1',
    ...overrides,
  };
}

function pendingRefund(overrides: Partial<AdminRefund> = {}): AdminRefund {
  return refund({
    id: 'r-pending',
    status: 'PENDING',
    processedAt: null,
    providerReference: null,
    pendingAgeMinutes: 12,
    pendingRecovery: true,
    ...overrides,
  });
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

function refundPage(
  items: AdminRefund[],
  overrides: Partial<AdminRefundListResult> = {},
): AdminRefundListResult {
  return { items, page: 1, limit: 20, total: items.length, totalPages: 1, ...overrides };
}

function orphan(overrides: Partial<OrphanProviderRefund> = {}): OrphanProviderRefund {
  return {
    id: 'o1',
    provider: 'stripe',
    providerRefundReference: 're_foreign_1',
    paymentProviderReference: 'pi_abc',
    amount: 50,
    currency: 'EUR',
    status: 'UNMATCHED',
    firstSeenAt: '2026-01-11T08:00:00Z',
    lastSeenAt: '2026-01-11T08:00:00Z',
    resolvedAt: null,
    resolutionNote: null,
    ...overrides,
  };
}

function orphanPage(items: OrphanProviderRefund[]): OrphanRefundListResult {
  return { items, page: 1, limit: 20, total: items.length, totalPages: 1 };
}

function ops(overrides: Partial<RefundOperations> = {}): RefundOperations {
  return {
    generatedAt: '2026-01-11T10:00:00Z',
    pending: {
      total: 1,
      buckets: { lt5m: 0, m5to15: 1, m15to60: 0, h1to6: 0, h6to24: 0, gt24h: 0 },
      stuckThresholdMinutes: 60,
      stuck: 0,
    },
    orphans: { unmatched: 0 },
    metrics: { since: '2026-01-11T00:00:00Z', counters: {}, gauges: {} },
    alerts: { active: [] },
    ...overrides,
  };
}

function mocks(refunds: AdminRefund[] = [refund()]) {
  return {
    api: {
      listRefunds: vi.fn().mockReturnValue(of(refundPage(refunds))),
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
      getRefundOperations: vi.fn().mockReturnValue(of(ops())),
      listOrphanRefunds: vi.fn().mockReturnValue(of(orphanPage([]))),
      resumeRefund: vi.fn().mockReturnValue(
        of({
          refund: pendingRefund({ status: 'PROCESSED', processedAt: '2026-01-11T10:05:00Z' }),
          payment: payment({ status: 'PARTIALLY_REFUNDED' }),
        } satisfies ResumeRefundResult),
      ),
      resolveOrphanRefund: vi.fn().mockReturnValue(
        of(orphan({ status: 'RESOLVED', resolvedAt: '2026-01-11T10:10:00Z' })),
      ),
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

    expect(m.api.listRefunds).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    const text = el.textContent!;
    expect(text).toContain('NVABC1');
    expect(text).toContain('€100.00');
    expect(text).toContain('Schedule change');
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

    expect(m.api.listRefunds).toHaveBeenLastCalledWith({
      status: 'PROCESSED',
      page: 1,
      limit: 20,
    });
  });

  it('maps the pending-age filter to pending age query params (3.4D)', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    const select = el.querySelector<HTMLSelectElement>('#refund-age')!;
    select.value = 'h1to6';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(m.api.listRefunds).toHaveBeenLastCalledWith({
      pendingMinAgeMinutes: 60,
      pendingMaxAgeMinutes: 360,
      page: 1,
      limit: 20,
    });
  });

  it('sends booking/provider reference and date filters', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    const booking = el.querySelector<HTMLInputElement>('#refund-booking-ref')!;
    booking.value = 'nvab12';
    booking.dispatchEvent(new Event('input'));
    booking.dispatchEvent(new Event('change'));
    await settle(fixture);

    expect(m.api.listRefunds).toHaveBeenLastCalledWith({
      bookingReference: 'nvab12',
      page: 1,
      limit: 20,
    });

    const provider = el.querySelector<HTMLInputElement>('#refund-provider-ref')!;
    provider.value = 're_123';
    provider.dispatchEvent(new Event('input'));
    provider.dispatchEvent(new Event('change'));
    await settle(fixture);

    expect(m.api.listRefunds).toHaveBeenLastCalledWith({
      bookingReference: 'nvab12',
      providerReference: 're_123',
      page: 1,
      limit: 20,
    });
  });

  it('sends refund/payment identifier filters', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    const refundId = el.querySelector<HTMLInputElement>('#refund-id')!;
    refundId.value = 'refund-uuid-1';
    refundId.dispatchEvent(new Event('input'));
    refundId.dispatchEvent(new Event('change'));
    await settle(fixture);

    expect(m.api.listRefunds).toHaveBeenLastCalledWith({
      refundId: 'refund-uuid-1',
      page: 1,
      limit: 20,
    });

    const paymentId = el.querySelector<HTMLInputElement>('#refund-payment-id')!;
    paymentId.value = 'payment-uuid-1';
    paymentId.dispatchEvent(new Event('input'));
    paymentId.dispatchEvent(new Event('change'));
    await settle(fixture);

    expect(m.api.listRefunds).toHaveBeenLastCalledWith({
      refundId: 'refund-uuid-1',
      paymentId: 'payment-uuid-1',
      page: 1,
      limit: 20,
    });
  });

  it('paginates with previous/next and shows the record count', async () => {
    const m = mocks();
    m.api.listRefunds.mockReturnValue(of(refundPage([refund()], { total: 45, totalPages: 3 })));
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Page 1 of 3 · 45 records');

    const next = [...el.querySelectorAll<HTMLElement>('.pagination na-button button')].find((b) =>
      b.textContent?.includes('Next'),
    )!;
    next.click();
    await settle(fixture);

    expect(m.api.listRefunds).toHaveBeenLastCalledWith({ page: 2, limit: 20 });

    const prev = [...el.querySelectorAll<HTMLElement>('.pagination na-button button')].find((b) =>
      b.textContent?.includes('Previous'),
    )!;
    prev.click();
    await settle(fixture);
    expect(m.api.listRefunds).toHaveBeenLastCalledWith({ page: 1, limit: 20 });
  });

  it('shows an error state with retry when the list fails to load', async () => {
    const m = mocks();
    m.api.listRefunds
      .mockReturnValueOnce(throwError(() => new Error('down')))
      .mockReturnValue(of(refundPage([refund()])));
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

  // ---------- Phase 3.4D operational visibility ----------

  it('renders the operations strip: pending, stuck and orphan chips plus active alerts', async () => {
    const m = mocks();
    m.api.getRefundOperations.mockReturnValue(
      of(
        ops({
          pending: {
            total: 4,
            buckets: { lt5m: 1, m5to15: 1, m15to60: 1, h1to6: 1, h6to24: 0, gt24h: 0 },
            stuckThresholdMinutes: 60,
            stuck: 2,
          },
          orphans: { unmatched: 1 },
          alerts: {
            active: [
              {
                code: 'refunds_stuck_pending',
                detail: '2 refund(s) PENDING beyond 60 minutes',
                since: '2026-01-11T09:00:00Z',
              },
            ],
          },
        }),
      ),
    );
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    const text = el.textContent!;
    expect(text).toContain('4 pending');
    expect(text).toContain('2 stuck beyond 60m');
    expect(text).toContain('1 unmatched provider refund');
    const alert = el.querySelector('.ops-alert');
    expect(alert?.textContent).toContain('2 refund(s) PENDING beyond 60 minutes');
  });

  it('shows pending age and the Needs attention chip for a stuck refund', async () => {
    const m = mocks([
      pendingRefund({ pendingAgeMinutes: 90 }),
      pendingRefund({ id: 'r-fresh', pendingAgeMinutes: 12 }),
    ]);
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    const text = el.textContent!;
    expect(text).toContain('1h 30m');
    expect(text).toContain('Needs attention');
    expect(text).toContain('Recovery pending');
  });

  it('renders the provider reference for refunds', async () => {
    const m = mocks([pendingRefund(), refund()]);
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    const text = el.textContent!;
    // The pending row falls back to the payment's provider reference.
    expect(text).toContain('mp_abc123');
    expect(text).toContain('re_123');
  });

  // ---------- Manual recovery (reuses the Batch 1 recovery core) ----------

  it('recovers a PENDING refund through the resume endpoint and reloads server state', async () => {
    const m = mocks([pendingRefund()]);
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    buttonByText(el, 'Recover')!.click();
    await settle(fixture);

    expect(m.api.resumeRefund).toHaveBeenCalledWith('r-pending');
    expect(m.toast.success).toHaveBeenCalledOnce();
    // List + operations + orphans are reloaded from the server afterwards.
    expect(m.api.listRefunds).toHaveBeenCalledTimes(2);
    expect(m.api.getRefundOperations).toHaveBeenCalledTimes(2);
  });

  it('a 502 from recovery means still-uncertain: warning toast, never a rejected claim', async () => {
    const m = mocks([pendingRefund()]);
    m.api.resumeRefund.mockReturnValue(
      throwError(() => ({ status: 502, error: { message: 'uncertain' } })),
    );
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    buttonByText(el, 'Recover')!.click();
    await settle(fixture);

    expect(m.toast.warning).toHaveBeenCalledOnce();
    expect(m.toast.warning.mock.calls[0]![0]).toContain('uncertain');
    expect(m.toast.success).not.toHaveBeenCalled();
    const toastText = m.toast.warning.mock.calls[0]![0] as string;
    expect(toastText).not.toContain('rejected');
  });

  it('a 409 from recovery surfaces the definitive rejection', async () => {
    const m = mocks([pendingRefund()]);
    m.api.resumeRefund.mockReturnValue(
      throwError(() => ({ status: 409, error: { message: 'Refund was definitively rejected by the payment provider' } })),
    );
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    buttonByText(el, 'Recover')!.click();
    await settle(fixture);

    expect(m.toast.error).toHaveBeenCalledWith(
      'Refund was definitively rejected by the payment provider',
    );
  });

  it('only offers Recover on PENDING rows and gates it behind payments:refund', async () => {
    const m = mocks([refund(), pendingRefund()]);
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(buttonByText(el, 'Recover')).not.toBeNull();
    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    // Exactly one Recover button — the PROCESSED row has none.
    expect(
      [...el.querySelectorAll('button')].filter((b) => b.textContent?.trim() === 'Recover').length,
    ).toBe(1);

    TestBed.resetTestingModule();
    const denied = mocks([pendingRefund()]);
    denied.auth.hasPermission.mockReturnValue(false);
    const deniedFixture = await setup(denied);
    const deniedEl = deniedFixture.nativeElement as HTMLElement;
    expect(buttonByText(deniedEl, 'Recover')).toBeNull();
  });

  // ---------- Orphan provider refunds (Phase 3.4E) ----------

  it('renders unmatched provider refunds with their strong references', async () => {
    const m = mocks();
    m.api.listOrphanRefunds.mockReturnValue(of(orphanPage([orphan()])));
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(m.api.listOrphanRefunds).toHaveBeenCalledWith({ status: 'UNMATCHED', limit: 20 });
    const section = el.querySelector('.orphans')!;
    expect(section.textContent).toContain('Unmatched provider refunds');
    expect(section.textContent).toContain('re_foreign_1');
    expect(section.textContent).toContain('pi_abc');
    expect(section.textContent).toContain('€50.00');
  });

  it('resolves an orphan with an optional note and reloads the operational state', async () => {
    const m = mocks();
    m.api.listOrphanRefunds.mockReturnValue(of(orphanPage([orphan()])));
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    const note = el.querySelector<HTMLInputElement>('.orphans input')!;
    note.value = 'Verified in the Stripe dashboard';
    note.dispatchEvent(new Event('input'));
    await settle(fixture);

    buttonByText(el, 'Resolve')!.click();
    await settle(fixture);

    expect(m.api.resolveOrphanRefund).toHaveBeenCalledWith('o1', 'Verified in the Stripe dashboard');
    expect(m.toast.success).toHaveBeenCalledOnce();
    expect(m.api.listOrphanRefunds).toHaveBeenCalledTimes(2);
    expect(m.api.getRefundOperations).toHaveBeenCalledTimes(2);
  });

  it('gates orphan resolution behind payments:refund', async () => {
    const m = mocks();
    m.api.listOrphanRefunds.mockReturnValue(of(orphanPage([orphan()])));
    m.auth.hasPermission.mockReturnValue(false);
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.orphans')).not.toBeNull();
    expect(buttonByText(el, 'Resolve')).toBeNull();
  });
});
