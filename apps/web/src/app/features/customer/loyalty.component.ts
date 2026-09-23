import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LoyaltyService } from '../../core/services/domain-services';
import { TIER_LABELS } from '../../core/status-maps';
import type { LoyaltyAccount, LoyaltyTier, LoyaltyTransactionType } from '../../core/models/domain.model';
import type { StatusTone } from '../../core/status-maps';
import { NaBadge } from '../../shared/ui/badge.component';
import { NaAlert } from '../../shared/ui/alert.component';
import { NaSkeleton } from '../../shared/ui/skeleton.component';

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
  imports: [NaBadge, NaAlert, NaSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="na-container page">
      <header class="page__head">
        <h1>NovaAir Miles</h1>
        <p class="na-text-muted">Your loyalty balance, tier progress, and activity.</p>
      </header>

      @if (error()) {
        <na-alert tone="danger" title="Could not load your loyalty account" retryable (retry)="load()">Please try again.</na-alert>
      } @else if (loading()) {
        <na-skeleton [rows]="[1, 2, 3]" height="6rem" />
      } @else if (account(); as acc) {
        <section class="balance na-card" aria-labelledby="balance-h">
          <div class="balance__top">
            <div>
              <h2 id="balance-h" class="na-visually-hidden">Miles balance</h2>
              <p class="balance__points">{{ acc.balance.toLocaleString('en-GB') }}</p>
              <p class="na-text-muted">miles available</p>
            </div>
            <div class="balance__meta">
              <na-badge tone="info">{{ TIER_LABELS[acc.tier] }} tier</na-badge>
              <p class="na-text-muted na-text-small">Member <span class="na-text-mono">{{ acc.memberNumber }}</span></p>
            </div>
          </div>

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
                >
                  <div class="tier-progress__fill" [style.width.%]="p.percent"></div>
                </div>
              } @else {
                <p class="na-text-muted">You hold our highest tier. Thank you for your loyalty.</p>
              }
            </div>
          }
        </section>

        <section class="na-card activity" aria-labelledby="activity-h">
          <h2 id="activity-h">Activity</h2>
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Date</th><th>Description</th><th>Type</th><th class="num">Miles</th></tr>
              </thead>
              <tbody>
                @for (tx of acc.transactions; track tx.id) {
                  <tr>
                    <td>{{ dateFmt(tx.createdAt) }}</td>
                    <td>{{ tx.description ?? '—' }}</td>
                    <td><na-badge [tone]="txTone(tx.type)">{{ tx.type }}</na-badge></td>
                    <td class="num" [class.pos]="tx.amount > 0" [class.neg]="tx.amount < 0">
                      {{ tx.amount > 0 ? '+' : '' }}{{ tx.amount.toLocaleString('en-GB') }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }
    </div>
  `,
  styles: `
    .page { padding: var(--na-space-8) 0 var(--na-space-16); max-width: 860px; }
    .page__head { margin-bottom: var(--na-space-6); }
    .balance { padding: var(--na-space-6); background: var(--na-navy-800); border-color: var(--na-navy-700); }
    .balance__top { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--na-space-4); flex-wrap: wrap; }
    .balance__points { font-size: var(--na-text-3xl); font-weight: var(--na-font-bold); color: var(--na-surface); }
    .balance .na-text-muted { color: var(--na-ink-100); }
    .balance__meta { display: grid; gap: var(--na-space-2); justify-items: end; }
    .tier-progress { margin-top: var(--na-space-6); }
    .tier-progress__labels { display: flex; justify-content: space-between; gap: var(--na-space-4); font-size: var(--na-text-sm); color: var(--na-ink-100); margin-bottom: var(--na-space-2); }
    .tier-progress__bar { height: 10px; border-radius: var(--na-radius-full); background: var(--na-navy-600); overflow: hidden; }
    .tier-progress__fill { height: 100%; border-radius: var(--na-radius-full); background: var(--na-cta); transition: width var(--na-motion-base) var(--na-ease); }
    .activity { margin-top: var(--na-space-6); padding: var(--na-space-5); }
    .activity h2 { font-size: var(--na-text-lg); margin-bottom: var(--na-space-4); }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: var(--na-text-sm); }
    th { text-align: left; padding: var(--na-space-2) var(--na-space-3); font-size: var(--na-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--na-ink-500); border-bottom: 1px solid var(--na-border); }
    td { padding: var(--na-space-3); border-bottom: 1px solid var(--na-border); }
    tr:last-child td { border-bottom: none; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    th.num { text-align: right; }
    .pos { color: var(--na-success); font-weight: var(--na-font-semibold); }
    .neg { color: var(--na-ink-500); }
  `,
})
export class LoyaltyPage {
  private readonly loyaltyService = inject(LoyaltyService);

  readonly TIER_LABELS = TIER_LABELS;

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly account = signal<LoyaltyAccount | null>(null);

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
