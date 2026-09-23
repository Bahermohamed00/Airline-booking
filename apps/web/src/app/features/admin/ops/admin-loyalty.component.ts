import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LoyaltyService } from '../../../core/services/domain-services';
import { ToastService } from '../../../shared/ui/toast.service';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { TIER_LABELS } from '../../../core/status-maps';
import type { LoyaltyAccount, LoyaltyTransaction, LoyaltyTransactionType } from '../../../core/models/domain.model';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';

const DATE_FMT = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });
const NUMBER_FMT = new Intl.NumberFormat('en-GB');

const TYPE_TONES: Record<LoyaltyTransactionType, { label: string; tone: 'success' | 'warning' | 'info' | 'neutral' }> = {
  EARN: { label: 'Earned', tone: 'success' },
  BURN: { label: 'Redeemed', tone: 'warning' },
  ADJUSTMENT: { label: 'Adjustment', tone: 'info' },
  EXPIRY: { label: 'Expired', tone: 'neutral' },
};

@Component({
  selector: 'na-admin-loyalty',
  standalone: true,
  imports: [FormsModule, HasPermissionDirective, NaBreadcrumbs, NaButton, NaBadge, NaSkeleton, NaEmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <na-breadcrumbs [items]="crumbs" />
      <header class="page__head">
        <h1>Loyalty</h1>
        <p class="page__sub">Frequent-flyer account overview and balance adjustments.</p>
      </header>

      @if (loading()) {
        <na-skeleton [rows]="[1, 2, 3, 4]" height="2.5rem" />
      } @else if (account(); as acc) {
        <div class="layout">
          <div>
            <div class="account na-card">
              <div>
                <p class="na-text-muted na-text-small">Member</p>
                <p class="account__member na-text-mono">{{ acc.memberNumber }}</p>
              </div>
              <div>
                <p class="na-text-muted na-text-small">Tier</p>
                <na-badge tone="info">{{ tierLabel(acc) }}</na-badge>
              </div>
              <div>
                <p class="na-text-muted na-text-small">Balance</p>
                <p class="account__balance">{{ formatNumber(acc.balance) }} pts</p>
              </div>
            </div>

            <h2 class="section-title">Transactions</h2>
            @if (acc.transactions.length === 0) {
              <na-empty-state icon="★" title="No transactions" message="This account has no loyalty activity yet." />
            } @else {
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Description</th>
                      <th class="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (tx of acc.transactions; track tx.id) {
                      <tr>
                        <td data-label="Date">{{ fmtDate(tx.createdAt) }}</td>
                        <td data-label="Type">
                          <na-badge [tone]="typeTone(tx.type).tone">{{ typeTone(tx.type).label }}</na-badge>
                        </td>
                        <td data-label="Description">{{ tx.description ?? '—' }}</td>
                        <td data-label="Amount" class="num" [class.num--neg]="tx.amount < 0" [class.num--pos]="tx.amount > 0">
                          {{ tx.amount > 0 ? '+' : '' }}{{ formatNumber(tx.amount) }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>

          <aside class="panel na-card" *naHasPermission="'loyalty:manage'" aria-label="Adjust balance">
            <h2 class="panel__title">Adjust balance</h2>
            <p class="na-text-muted na-text-small">Use a negative amount to deduct points. Adjustments are audit-logged.</p>
            <form (ngSubmit)="adjust()">
              <div class="na-field">
                <label class="na-label" for="adjust-amount">Amount (points)</label>
                <input
                  id="adjust-amount"
                  class="na-input"
                  type="number"
                  step="1"
                  required
                  [ngModel]="amount()"
                  (ngModelChange)="amount.set($event)"
                  name="amount"
                />
                <p class="na-hint">e.g. 500 to credit, -250 to debit.</p>
              </div>
              <div class="na-field">
                <label class="na-label" for="adjust-desc">Description</label>
                <input
                  id="adjust-desc"
                  class="na-input"
                  required
                  placeholder="e.g. Service recovery credit"
                  [ngModel]="description()"
                  (ngModelChange)="description.set($event)"
                  name="description"
                />
              </div>
              @if (formError()) {
                <p class="na-error" role="alert">{{ formError() }}</p>
              }
              <na-button variant="primary" type="submit">Apply adjustment</na-button>
            </form>
          </aside>
        </div>
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .page { max-width: var(--na-admin-max); }
    .page__head { margin-bottom: var(--na-space-6); }
    .page__sub { color: var(--na-ink-500); margin-top: var(--na-space-1); }
    .layout { display: grid; grid-template-columns: 1fr 340px; gap: var(--na-space-5); align-items: start; }
    .account { display: flex; gap: var(--na-space-8); flex-wrap: wrap; padding: var(--na-space-5); margin-bottom: var(--na-space-6); }
    .account__member { font-size: var(--na-text-lg); font-weight: var(--na-font-semibold); }
    .account__balance { font-size: var(--na-text-xl); font-weight: var(--na-font-bold); color: var(--na-blue-600); }
    .section-title { font-size: var(--na-text-xl); margin-bottom: var(--na-space-4); }
    .table-wrap { overflow-x: auto; border: 1px solid var(--na-border); border-radius: var(--na-radius-lg); background: var(--na-surface-raised); }
    table { width: 100%; border-collapse: collapse; font-size: var(--na-text-sm); }
    th { text-align: left; padding: var(--na-space-3) var(--na-space-4); font-size: var(--na-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--na-ink-500); border-bottom: 1px solid var(--na-border); background: var(--na-surface-sunken); white-space: nowrap; }
    td { padding: var(--na-space-3) var(--na-space-4); border-bottom: 1px solid var(--na-border); }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .num--pos { color: var(--na-success); font-weight: var(--na-font-semibold); }
    .num--neg { color: var(--na-danger); font-weight: var(--na-font-semibold); }
    .panel { padding: var(--na-space-5); position: sticky; top: var(--na-space-4); }
    .panel__title { font-size: var(--na-text-xl); margin-bottom: var(--na-space-1); }
    @media (max-width: 1023px) {
      .layout { grid-template-columns: 1fr; }
      .panel { position: static; }
    }
    @media (max-width: 639px) {
      table, thead, tbody, tr, td { display: block; }
      thead { display: none; }
      tr { border-bottom: 1px solid var(--na-border); padding: var(--na-space-2) 0; }
      td { border: none; padding: var(--na-space-1) var(--na-space-4); text-align: left; }
      td::before { content: attr(data-label) ': '; font-weight: var(--na-font-semibold); color: var(--na-ink-500); }
    }
  `,
})
export class AdminLoyaltyPage {
  private readonly loyaltyService = inject(LoyaltyService);
  private readonly toast = inject(ToastService);

  readonly crumbs = [
    { label: 'Admin', link: '/admin/dashboard' },
    { label: 'Loyalty' },
  ];

  readonly loading = signal(true);
  readonly account = signal<LoyaltyAccount | null>(null);
  readonly amount = signal<number | null>(null);
  readonly description = signal('');
  readonly formError = signal<string | null>(null);

  constructor() {
    this.loyaltyService.account().subscribe((acc) => {
      this.account.set({ ...acc, transactions: [...acc.transactions] });
      this.loading.set(false);
    });
  }

  tierLabel(acc: LoyaltyAccount): string {
    return TIER_LABELS[acc.tier];
  }

  typeTone(type: LoyaltyTransactionType) {
    return TYPE_TONES[type] ?? { label: type, tone: 'neutral' as const };
  }

  fmtDate(iso: string): string {
    return DATE_FMT.format(new Date(iso));
  }

  formatNumber(n: number): string {
    return NUMBER_FMT.format(n);
  }

  adjust(): void {
    const acc = this.account();
    const amount = Number(this.amount());
    const description = this.description().trim();
    if (!acc) return;
    if (!Number.isFinite(amount) || amount === 0) {
      this.formError.set('Enter a non-zero point amount.');
      return;
    }
    if (!description) {
      this.formError.set('A description is required.');
      return;
    }
    const tx: LoyaltyTransaction = {
      id: crypto.randomUUID(),
      loyaltyAccountId: acc.id,
      amount,
      type: 'ADJUSTMENT',
      description,
      createdAt: new Date().toISOString(),
    };
    this.account.set({
      ...acc,
      balance: acc.balance + amount,
      transactions: [tx, ...acc.transactions],
    });
    this.toast.success(
      `Balance adjusted by ${amount > 0 ? '+' : ''}${this.formatNumber(amount)} pts — new balance ${this.formatNumber(acc.balance + amount)} pts.`,
    );
    this.amount.set(null);
    this.description.set('');
    this.formError.set(null);
  }
}
