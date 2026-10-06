import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
  type ValidationErrors,
} from '@angular/forms';
import { formatMoney } from '../../../core/services/pricing.service';
import { PAYMENT_STATUS_MAP, statusLabel } from '../../../core/status-maps';
import type { AdminPayment } from '../../../core/models/payment.model';
import { NaDialog } from '../../../shared/ui/dialog.component';

export interface RefundRequest {
  paymentId: string;
  amount?: number;
  reason?: string;
}

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

/**
 * Shared "issue refund" dialog. Two modes:
 * - direct: `[payment]` is set — refunds that payment;
 * - picker: `[payments]` + `[(paymentId)]` — the staff member picks one of the
 *   refundable payments first (used on the refunds page).
 * The parent owns the API call; this component only validates and emits.
 */
@Component({
  selector: 'na-refund-dialog',
  imports: [ReactiveFormsModule, FormsModule, NaDialog],
  template: `
    <na-dialog
      [open]="open()"
      title="Issue refund"
      confirmLabel="Issue refund"
      (confirmed)="onSubmit()"
      (cancelled)="cancelled.emit()"
    >
      @if (pickerMode()) {
        <div class="na-field">
          <label class="na-label" for="refund-payment">Payment</label>
          <select
            id="refund-payment"
            class="na-select"
            [ngModel]="paymentId()"
            (ngModelChange)="onPaymentPicked($event)"
          >
            <option value="" disabled>Select a payment…</option>
            @for (p of payments(); track p.id) {
              <option [value]="p.id">
                {{ p.bookingReference }} — {{ money(p.amount, p.currency) }} —
                {{ statusLabel(PAYMENT_STATUS_MAP, p.status).label }}
              </option>
            }
          </select>
          @if (attempted() && !effectivePayment()) {
            <span class="na-error">Select a payment to refund.</span>
          }
        </div>
      }

      @if (effectivePayment(); as p) {
        <p class="summary">
          Refunding payment for booking <span class="na-text-mono">{{ p.bookingReference }}</span>
          — paid {{ money(p.amount, p.currency) }} via {{ p.provider }}.
          @if (remaining() !== null) {
            Refundable remainder: <strong>{{ money(remaining()!, p.currency) }}</strong>.
          }
        </p>

        <form [formGroup]="form" (ngSubmit)="onSubmit()">
          <div class="na-field">
            <label class="na-label" for="refund-amount">Amount ({{ p.currency }})</label>
            <input
              id="refund-amount"
              class="na-input"
              type="text"
              inputmode="decimal"
              formControlName="amount"
              [placeholder]="amountPlaceholder()"
              [attr.aria-invalid]="form.controls.amount.invalid && form.controls.amount.touched"
            />
            <span class="na-text-muted na-text-small">Leave empty to refund the full remainder.</span>
            @if (form.controls.amount.touched && form.controls.amount.errors?.['pattern']) {
              <span class="na-error">Enter a valid amount with at most 2 decimals.</span>
            }
            @if (form.controls.amount.touched && form.controls.amount.errors?.['notPositive']) {
              <span class="na-error">The amount must be greater than zero.</span>
            }
            @if (form.controls.amount.touched && form.controls.amount.errors?.['exceedsRemaining']) {
              <span class="na-error">
                The amount exceeds the refundable remainder
                ({{ money(remaining() ?? 0, p.currency) }}).
              </span>
            }
          </div>
          <div class="na-field">
            <label class="na-label" for="refund-reason">Reason (optional)</label>
            <textarea
              id="refund-reason"
              class="na-input"
              rows="3"
              formControlName="reason"
              maxlength="500"
              [attr.aria-invalid]="form.controls.reason.invalid && form.controls.reason.touched"
            ></textarea>
            @if (form.controls.reason.touched && form.controls.reason.errors?.['maxlength']) {
              <span class="na-error">The reason must be 500 characters or fewer.</span>
            }
          </div>
        </form>
      } @else if (!pickerMode()) {
        <p class="na-text-muted">No payment selected.</p>
      }
    </na-dialog>
  `,
  styles: `
    .summary { font-size: var(--na-text-sm); color: var(--na-ink-700); margin-bottom: var(--na-space-4); }
    .na-field { margin-bottom: var(--na-space-4); }
    textarea.na-input { resize: vertical; font-family: inherit; }
  `,
})
export class NaRefundDialog {
  private readonly fb = inject(FormBuilder);

  readonly open = input(false);
  /** Direct mode: the payment to refund. */
  readonly payment = input<AdminPayment | null>(null);
  /** Picker mode: refundable payments to choose from. */
  readonly payments = input<AdminPayment[]>([]);
  /** Picker mode: two-way bound selected payment id. */
  readonly paymentId = model<string>('');

  readonly submitted = output<RefundRequest>();
  readonly cancelled = output<void>();

  readonly attempted = signal(false);

  readonly form = this.fb.nonNullable.group({
    amount: ['', [Validators.pattern(AMOUNT_PATTERN), (c: AbstractControl<string>) => this.withinRemaining(c)]],
    reason: ['', [Validators.maxLength(500)]],
  });

  readonly pickerMode = computed(() => this.payment() === null);

  readonly effectivePayment = computed(() => {
    const direct = this.payment();
    if (direct) return direct;
    const id = this.paymentId();
    return this.payments().find((p) => p.id === id) ?? null;
  });

  /** Full refundable remainder: payment amount minus already processed refunds. */
  readonly remaining = computed(() => {
    const p = this.effectivePayment();
    if (!p) return null;
    const refunded = p.refunds
      .filter((r) => r.status === 'PROCESSED')
      .reduce((sum, r) => sum + r.amount, 0);
    return Math.max(0, Math.round((p.amount - refunded) * 100) / 100);
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        this.form.reset();
        this.attempted.set(false);
      }
    });
  }

  onPaymentPicked(id: string): void {
    this.paymentId.set(id);
    this.form.controls.amount.updateValueAndValidity();
  }

  onSubmit(): void {
    this.attempted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const p = this.effectivePayment();
    if (!p) return;
    const rawAmount = this.form.controls.amount.value.trim();
    const reason = this.form.controls.reason.value.trim();
    const request: RefundRequest = { paymentId: p.id };
    if (rawAmount) request.amount = Math.round(Number(rawAmount) * 100) / 100;
    if (reason) request.reason = reason;
    this.submitted.emit(request);
  }

  money(amount: number, currency: string): string {
    return formatMoney(amount, currency);
  }

  readonly amountPlaceholder = computed(() => {
    const remaining = this.remaining();
    return remaining !== null ? remaining.toFixed(2) : '';
  });

  readonly PAYMENT_STATUS_MAP = PAYMENT_STATUS_MAP;
  readonly statusLabel = statusLabel;

  private withinRemaining(control: AbstractControl<string>): ValidationErrors | null {
    const raw = control.value.trim();
    if (!raw) return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return { notPositive: true };
    const max = this.remaining();
    if (max !== null && value > max) return { exceedsRemaining: { max } };
    return null;
  }
}
