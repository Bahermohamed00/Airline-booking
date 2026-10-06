import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { BaggageService } from '../../../core/services/domain-services';
import { BAGGAGE_STATUS_MAP, statusLabel } from '../../../core/status-maps';
import type { StatusTone } from '../../../core/status-maps';
import type { Baggage, BaggageEvent } from '../../../core/models/domain.model';
import { NaButton } from '../../../shared/ui/button.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';
import type { TimelineEvent } from '../../../shared/ui/timeline.component';

interface JourneyEvent extends TimelineEvent {
  current: boolean;
}

@Component({
  selector: 'app-baggage',
  standalone: true,
  imports: [ReactiveFormsModule, NaButton, NaAlert, NaBadge, NaSkeleton, NaEmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="na-container page">
      <header class="page__head">
        <h1>Track your baggage</h1>
        <p class="page__sub">Enter the tag number from your baggage receipt to follow your bag's journey.</p>
      </header>

      <div class="search na-card">
        <form [formGroup]="form" (ngSubmit)="search()" class="search__row">
          <div class="na-field">
            <label class="na-label" for="tag">Baggage tag number</label>
            <input id="tag" class="na-input na-text-mono" type="text" formControlName="tag" placeholder="e.g. NV400123456" autocomplete="off" aria-describedby="tag-hint" [attr.aria-invalid]="form.controls.tag.invalid && form.controls.tag.touched" />
            <span id="tag-hint" class="na-hint">Find it on your bag receipt — demo tag: NV400123456</span>
            @if (form.controls.tag.touched && form.controls.tag.errors?.['required']) { <span class="na-error">Tag number is required.</span> }
          </div>
          <na-button variant="cta" size="lg" type="submit" [loading]="loading()" [disabled]="form.invalid">Track</na-button>
        </form>
      </div>

      @if (error()) {
        <na-alert tone="danger" title="Tracking failed" retryable (retry)="search()">We couldn't find that bag — check the tag number and try again.</na-alert>
      } @else if (loading()) {
        <na-skeleton [rows]="[1]" height="11rem" />
        <na-skeleton [rows]="[1]" height="18rem" />
      } @else if (searched() && !bag()) {
        <na-empty-state
          title="Bag not found"
          message="We could not find a bag with that tag number. Check the number on your receipt and try again."
        />
      } @else if (bag(); as b) {
        @if (isException(b)) {
          <na-alert tone="warning" title="There is an issue with this bag">
            This bag is currently marked as {{ statusLabel(BAGGAGE_STATUS_MAP, b.status).label.toLowerCase() }}.
            Our team is working on it — contact support with your tag number for assistance.
            <div class="alert-action">
              <na-button variant="secondary" size="sm" (clicked)="router.navigate(['/help'])">Contact support</na-button>
            </div>
          </na-alert>
        }

        <section class="tracker na-card" aria-labelledby="bag-status-h">
          <div class="status">
            <h2 id="bag-status-h" class="status__title">Current status</h2>
            <div class="status__hero">
              <na-badge class="status__badge" [tone]="statusLabel(BAGGAGE_STATUS_MAP, b.status).tone">
                {{ statusLabel(BAGGAGE_STATUS_MAP, b.status).label }}
              </na-badge>
              <p class="status__tag">{{ b.tagNumber }}</p>
            </div>
            @if (lastEvent(); as le) {
              <p class="status__last">
                Last update
                @if (le.location) { — {{ le.location }} }
                · <span class="status__time">{{ fmtDt(le.occurredAt) }}</span>
              </p>
            }
            <dl class="status__facts">
              <div><dt>Type</dt><dd>{{ typeLabel(b) }}</dd></div>
              <div><dt>Pieces</dt><dd>{{ b.pieces }}</dd></div>
              @if (b.weightKg != null) { <div><dt>Weight</dt><dd>{{ b.weightKg }} kg</dd></div> }
            </dl>
          </div>

          <div class="journey">
            <h2 class="journey__title">Journey</h2>
            <ol class="jt">
              @for (e of journey(); track e.label + (e.timestamp ?? '')) {
                <li class="jt__item" [class.jt__item--current]="e.current">
                  <span class="jt__dot jt__dot--{{ e.tone ?? 'info' }}" aria-hidden="true"></span>
                  <div class="jt__body">
                    <p class="jt__label">
                      {{ e.label }}
                      @if (e.current) { <span class="jt__now">Now</span> }
                    </p>
                    @if (e.detail) { <p class="jt__detail">{{ e.detail }}</p> }
                    @if (e.timestamp) { <time class="jt__time">{{ e.timestamp }}</time> }
                  </div>
                </li>
              }
            </ol>
          </div>
        </section>
      }
    </div>
  `,
  styles: `
    .page { padding: var(--na-space-8) 0 var(--na-space-16); max-width: 720px; }
    .page__head { margin-bottom: var(--na-space-6); }
    .page__sub { color: var(--na-ink-500); margin-top: var(--na-space-2); }
    .search { padding: var(--na-space-6); margin-bottom: var(--na-space-6); }
    .search__row { display: grid; grid-template-columns: 1fr auto; gap: var(--na-space-4); align-items: end; }
    .search__row .na-field { margin-bottom: 0; }
    .tracker { padding: var(--na-space-6); margin-top: var(--na-space-4); }
    .status__title {
      font-family: var(--na-font-family); font-size: var(--na-text-xs); font-weight: var(--na-font-semibold);
      text-transform: uppercase; letter-spacing: 0.1em; color: var(--na-ink-500);
      margin-bottom: var(--na-space-4);
    }
    .status__hero { display: flex; flex-direction: column; align-items: flex-start; gap: var(--na-space-3); }
    .status__badge { display: inline-block; transform: scale(1.4); transform-origin: left center; margin: var(--na-space-1) 0; }
    .status__tag {
      font-family: var(--na-font-mono); font-size: var(--na-text-xl);
      letter-spacing: 0.05em; color: var(--na-ink-900);
    }
    .status__last { margin-top: var(--na-space-3); color: var(--na-ink-500); font-size: var(--na-text-sm); }
    .status__time { font-family: var(--na-font-mono); font-size: var(--na-text-xs); color: var(--na-ink-700); }
    .status__facts {
      display: grid; grid-template-columns: 1fr 1fr; gap: var(--na-space-4);
      margin: var(--na-space-5) 0 0; padding-top: var(--na-space-5);
      border-top: 1px solid var(--na-border);
    }
    .status__facts dt { font-size: var(--na-text-xs); text-transform: uppercase; letter-spacing: 0.06em; color: var(--na-ink-500); margin-bottom: var(--na-space-1); }
    .status__facts dd { margin: 0; font-weight: var(--na-font-medium); color: var(--na-ink-900); }
    .journey { margin-top: var(--na-space-6); padding-top: var(--na-space-6); border-top: 1px solid var(--na-border); }
    .journey__title { font-size: var(--na-text-lg); margin-bottom: var(--na-space-5); }
    .jt { list-style: none; margin: 0; padding: 0; }
    .jt__item { display: flex; gap: var(--na-space-3); padding-bottom: var(--na-space-5); position: relative; }
    .jt__item:last-child { padding-bottom: 0; }
    .jt__item:not(:last-child)::before {
      content: ''; position: absolute; left: 7px; top: 20px; bottom: 0; width: 2px; background: var(--na-border);
    }
    .jt__dot {
      position: relative; width: 16px; height: 16px; border-radius: 50%;
      flex-shrink: 0; margin-top: 2px; background: var(--na-info);
    }
    .jt__dot--success { background: var(--na-success); }
    .jt__dot--warning { background: var(--na-warning); }
    .jt__dot--danger { background: var(--na-danger); }
    .jt__dot--neutral { background: var(--na-ink-300); }
    .jt__item--current .jt__dot { box-shadow: 0 0 0 3px var(--na-surface-raised), 0 0 0 5px var(--na-cta); }
    .jt__label {
      display: flex; align-items: center; gap: var(--na-space-2); flex-wrap: wrap;
      font-weight: var(--na-font-semibold); color: var(--na-ink-900);
    }
    .jt__now {
      font-size: var(--na-text-xs); font-weight: var(--na-font-semibold);
      text-transform: uppercase; letter-spacing: 0.06em;
      padding: 0.05rem 0.5rem; border-radius: var(--na-radius-full);
      background: var(--na-cta); color: var(--na-cta-contrast);
    }
    .jt__detail { color: var(--na-ink-700); font-size: var(--na-text-sm); }
    .jt__time { font-family: var(--na-font-mono); color: var(--na-ink-500); font-size: var(--na-text-xs); }
    .alert-action { margin-top: var(--na-space-3); }
    @media (max-width: 639px) {
      .search__row { grid-template-columns: 1fr; }
      .search__row na-button { display: contents; }
      .tracker { padding: var(--na-space-5); }
      .status__facts { grid-template-columns: 1fr; }
    }
  `,
})
export class BaggagePage {
  private readonly fb = inject(FormBuilder);
  private readonly baggageService = inject(BaggageService);
  readonly router = inject(Router);

  readonly BAGGAGE_STATUS_MAP = BAGGAGE_STATUS_MAP;
  readonly statusLabel = statusLabel;

  readonly loading = signal(false);
  readonly error = signal(false);
  readonly searched = signal(false);
  readonly bag = signal<Baggage | undefined>(undefined);

  private readonly dtFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  readonly form = this.fb.nonNullable.group({
    tag: ['', Validators.required],
  });

  readonly journey = computed<JourneyEvent[]>(() => {
    const b = this.bag();
    if (!b) return [];
    return [...b.events]
      .sort((a, c) => a.occurredAt.localeCompare(c.occurredAt))
      .map((event) => {
        const status = BAGGAGE_STATUS_MAP[event.eventType as keyof typeof BAGGAGE_STATUS_MAP];
        const statusText = status?.label ?? event.eventType.replaceAll('_', ' ');
        return {
          label: event.location ?? statusText,
          detail: event.location ? statusText : undefined,
          timestamp: this.dtFmt.format(new Date(event.occurredAt)),
          tone: status?.tone ?? ('info' as StatusTone),
          current: event.eventType === b.status,
        };
      });
  });

  readonly lastEvent = computed<BaggageEvent | null>(() => {
    const b = this.bag();
    if (!b || b.events.length === 0) return null;
    return [...b.events].sort((a, c) => a.occurredAt.localeCompare(c.occurredAt)).at(-1) ?? null;
  });

  search(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(false);
    this.baggageService.track(this.form.getRawValue().tag).subscribe({
      next: (bag) => {
        this.bag.set(bag);
        this.loading.set(false);
        this.searched.set(true);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  isException(b: Baggage): boolean {
    return b.status === 'LOST' || b.status === 'DELAYED';
  }

  typeLabel(b: Baggage): string {
    return b.type === 'CHECKED' ? 'Checked bag' : b.type === 'CARRY_ON' ? 'Carry-on' : 'Special baggage';
  }

  fmtDt(iso: string): string {
    return this.dtFmt.format(new Date(iso));
  }
}
