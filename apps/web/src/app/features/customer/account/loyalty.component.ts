import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LoyaltyService } from '../../../core/services/domain-services';
import { TIER_LABELS } from '../../../shared/utils/status-maps';
import type { LoyaltyAccount, LoyaltyTier, LoyaltyTransactionType } from '../../../core/models/domain.model';
import type { StatusTone } from '../../../shared/utils/status-maps';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';

const TIER_THRESHOLDS: { tier: LoyaltyTier; points: number }[] = [
  { tier: 'MEMBER', points: 0 },
  { tier: 'SILVER', points: 10000 },
  { tier: 'GOLD', points: 40000 },
  { tier: 'HON_CIRCLE', points: 100000 },
];

const TX_TONES: Record<LoyaltyTransactionType, StatusTone> = {
  EARN: 'success',
  BURN: 'neutral',
  ADJUSTMENT: 'info',
  EXPIRY: 'warning',
};

@Component({
  selector: 'app-loyalty',
  standalone: true,
  imports: [NaBadge, NaAlert, NaSkeleton, NaEmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="na-container page">
      <header class="page__head">
        <h1>NovaAir Miles</h1>
        <p class="page__sub">Your loyalty balance, tier progress, and activity.</p>
      </header>

      @if (error()) {
        <na-alert tone="danger" title="Could not load your loyalty account" retryable (retry)="load()">Please try again.</na-alert>
      } @else if (loading()) {
        <na-skeleton [rows]="[1]" height="19rem" />
        <na-skeleton [rows]="[1]" height="14rem" />
      } @else if (account(); as acc) {
        <section class="hero" aria-labelledby="tier-h">
          <div class="hero__head">
            <div>
              <p class="hero__brand">NovaAir Miles</p>
              <h2 id="tier-h" class="hero__tier">{{ TIER_LABELS[acc.tier] }}</h2>
            </div>
            <na-badge tone="info">{{ TIER_LABELS[acc.tier] }} tier</na-badge>
          </div>

          <p class="hero__points">{{ acc.balance.toLocaleString('en-GB') }}</p>
          <p class="hero__label">miles available</p>
          <p class="hero__member na-text-small">Member <span class="na-text-mono">{{ acc.memberNumber }}</span></p>

          @if (progress(); as p) {
            <div class="tier-progress">
              @if (p.next) {
                <div class="tier-progress__labels">
                  <span>{{ TIER_LABELS[p.current] }}</span>
                  <span>{{ p.remaining.toLocaleString('en-GB') }} miles to {{ TIER_LABELS[p.next] }}</span>
                </div>
                <div
                  class="tier-progress__bar"
                  role="progressbar"
                  [attr.aria-valuenow]="p.percent"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  [attr.aria-label]="'Progress to ' + TIER_LABELS[p.next] + ' tier'"
                  [attr.aria-valuetext]="p.remaining.toLocaleString('en-GB') + ' miles to ' + TIER_LABELS[p.next] + ' tier'"
                >
                  <div class="tier-progress__fill" [style.width.%]="p.percent"></div>
                </div>
              } @else {
                <p class="tier-progress__max">You hold our highest tier. Thank you for your loyalty.</p>
              }
            </div>
          }
        </section>

        <section class="na-card activity" aria-labelledby="activity-h">
          <h2 id="activity-h">Activity</h2>
          @if (acc.transactions.length === 0) {
            <na-empty-state
              icon="✦"
              title="No miles activity yet"
              message="Earn and redeem miles on eligible flights — your transactions will appear here."
            />
          } @else {
            <div class="table-wrap">
              <table>
                <thead>
                  <tr><th>Date</th><th>Description</th><th>Type</th><th class="num">Miles</th></tr>
                </thead>
                <tbody>
                  @for (tx of acc.transactions; track tx.id) {
                    <tr>
                      <td class="date">{{ dateFmt(tx.createdAt) }}</td>
                      <td>{{ tx.description ?? '—' }}</td>
                      <td class="type"><na-badge [tone]="txTone(tx.type)">{{ tx.type }}</na-badge></td>
                      <td class="num" [class.pos]="tx.amount > 0" [class.neg]="tx.amount < 0">
                        {{ tx.amount > 0 ? '+' : '' }}{{ tx.amount.toLocaleString('en-GB') }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <ul class="how">
          <li>Earn and redeem miles on eligible flights.</li>
          <li>{{ tierLine }}.</li>
          <li>Earnings, redemptions, adjustments and expiries all appear in your activity.</li>
        </ul>
      }
    </div>
  `,
  styles: `
    .page { padding: var(--na-space-8) 0 var(--na-space-16); max-width: 860px; }
    .page__head { margin-bottom: var(--na-space-6); }
    .page__sub { color: var(--na-ink-500); margin-top: var(--na-space-2); }
    .hero {
      position: relative;
      padding: var(--na-space-8);
      background: linear-gradient(135deg, var(--na-navy-800), var(--na-navy-700));
      border: 1px solid var(--na-border);
      border-radius: var(--na-radius-lg);
      box-shadow: var(--na-shadow-lg);
    }
    .hero__head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--na-space-4); }
    .hero__brand {
      margin-bottom: var(--na-space-2);
      font-size: var(--na-text-xs); font-weight: var(--na-font-semibold);
      letter-spacing: 0.14em; text-transform: uppercase; color: var(--na-ink-500);
    }
    .hero__tier { font-size: var(--na-text-xl); }
    .hero__points {
      margin-top: var(--na-space-8);
      font-family: var(--na-font-display); font-weight: var(--na-font-bold);
      font-size: clamp(2.75rem, 8vw, 3.5rem); line-height: var(--na-leading-tight); letter-spacing: -0.01em;
    }
    .hero__label { color: var(--na-ink-500); }
    .hero__member { color: var(--na-ink-500); margin-top: var(--na-space-4); }
    .tier-progress {
      margin-top: var(--na-space-8); padding-top: var(--na-space-6);
      border-top: 1px solid var(--na-border);
    }
    .tier-progress__labels { display: flex; justify-content: space-between; flex-wrap: wrap; gap: var(--na-space-2) var(--na-space-4); font-size: var(--na-text-sm); color: var(--na-ink-700); margin-bottom: var(--na-space-3); }
    .tier-progress__bar {
      height: 8px; border-radius: var(--na-radius-full);
      background: var(--na-surface-sunken);
      box-shadow: inset 0 0 0 1px var(--na-border);
      overflow: hidden;
    }
    .tier-progress__fill { height: 100%; border-radius: var(--na-radius-full); background: var(--na-cta); transition: width var(--na-motion-base) var(--na-ease); }
    .tier-progress__max { font-size: var(--na-text-sm); color: var(--na-ink-700); }
    .activity { margin-top: var(--na-space-6); padding: var(--na-space-6); }
    .activity h2 { font-size: var(--na-text-lg); margin-bottom: var(--na-space-4); }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: var(--na-text-sm); }
    th { text-align: left; padding: var(--na-space-2) var(--na-space-3); font-size: var(--na-text-xs); font-weight: var(--na-font-semibold); text-transform: uppercase; letter-spacing: 0.06em; color: var(--na-ink-500); border-bottom: 1px solid var(--na-border); }
    td { padding: var(--na-space-3); border-bottom: 1px solid var(--na-border); }
    tbody tr { transition: background var(--na-motion-fast) var(--na-ease); }
    tbody tr:hover { background: var(--na-surface-sunken); }
    tr:last-child td { border-bottom: none; }
    .date { color: var(--na-ink-500); white-space: nowrap; }
    .num, th.num { text-align: right; }
    .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .pos { color: var(--na-success); font-weight: var(--na-font-semibold); }
    .neg { color: var(--na-danger); font-weight: var(--na-font-semibold); }
    .how { list-style: none; margin: var(--na-space-6) 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--na-space-2) var(--na-space-6); color: var(--na-ink-500); font-size: var(--na-text-sm); }
    @media (max-width: 639px) {
      .hero { padding: var(--na-space-5); }
      .activity { padding: var(--na-space-5); }
      // Stack transaction rows: description + amount on line 1, date + type on line 2.
      .activity thead { display: none; }
      .activity table, .activity tbody { display: block; }
      .activity tr {
        display: grid; grid-template-columns: 1fr auto;
        gap: var(--na-space-1) var(--na-space-3);
        padding: var(--na-space-3) 0;
      }
      .activity td { padding: 0; border-bottom: none; }
      .activity td.date { grid-column: 1; grid-row: 2; white-space: normal; font-size: var(--na-text-xs); }
      .activity td.type { grid-column: 2; grid-row: 2; justify-self: end; }
      .activity td.num { grid-column: 2; grid-row: 1; align-self: start; }
      .activity tbody tr { border-bottom: 1px solid var(--na-border); }
      .activity tbody tr:last-child { border-bottom: none; }
      .activity tbody tr:hover { background: none; }
    }
  `,
})
export class LoyaltyPage {
  private readonly loyaltyService = inject(LoyaltyService);

  readonly TIER_LABELS = TIER_LABELS;

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly account = signal<LoyaltyAccount | null>(null);

  readonly tierLine = TIER_THRESHOLDS.slice(1)
    .map((t) => `${TIER_LABELS[t.tier]} from ${t.points.toLocaleString('en-GB')} miles`)
    .join(' · ');

  private readonly dFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

  readonly progress = computed(() => {
    const acc = this.account();
    if (!acc) return null;
    const currentIndex = TIER_THRESHOLDS.findIndex((t) => t.tier === acc.tier);
    const current = TIER_THRESHOLDS[currentIndex] ?? TIER_THRESHOLDS[0];
    const next = TIER_THRESHOLDS[currentIndex + 1];
    if (!next) return { current: current.tier, next: null, remaining: 0, percent: 100 };
    const span = next.points - current.points;
    const earned = Math.min(Math.max(acc.balance - current.points, 0), span);
    return {
      current: current.tier,
      next: next.tier,
      remaining: Math.max(0, next.points - acc.balance),
      percent: Math.round((earned / span) * 100),
    };
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.loyaltyService.account().subscribe({
      next: (account) => {
        this.account.set(account);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  txTone(type: LoyaltyTransactionType): StatusTone {
    return TX_TONES[type] ?? 'neutral';
  }

  dateFmt(iso: string): string {
    return this.dFmt.format(new Date(iso));
  }
}
