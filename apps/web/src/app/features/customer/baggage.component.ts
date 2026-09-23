import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { BaggageService } from '../../core/services/domain-services';
import { BAGGAGE_STATUS_MAP, statusLabel } from '../../core/status-maps';
import type { Baggage } from '../../core/models/domain.model';
import { NaButton } from '../../shared/ui/button.component';
import { NaAlert } from '../../shared/ui/alert.component';
import { NaBadge } from '../../shared/ui/badge.component';
import { NaSkeleton } from '../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../shared/ui/empty-state.component';
import { NaTimeline, TimelineEvent } from '../../shared/ui/timeline.component';

@Component({
  selector: 'app-baggage',
  standalone: true,
  imports: [ReactiveFormsModule, NaButton, NaAlert, NaBadge, NaSkeleton, NaEmptyState, NaTimeline],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="na-container page">
      <header class="page__head">
        <h1>Track your baggage</h1>
        <p class="na-text-muted">Enter the tag number from your baggage receipt to follow your bag's journey.</p>
      </header>

      <div class="search na-card">
        <form [formGroup]="form" (ngSubmit)="search()" class="search__row">
          <div class="na-field">
            <label class="na-label" for="tag">Baggage tag number</label>
            <input id="tag" class="na-input na-text-mono" type="text" formControlName="tag" placeholder="e.g. NV400123456" autocomplete="off" aria-describedby="tag-hint" [attr.aria-invalid]="form.controls.tag.invalid && form.controls.tag.touched" />
            <span id="tag-hint" class="na-hint">Demo tag: NV400123456</span>
            @if (form.controls.tag.touched && form.controls.tag.errors?.['required']) { <span class="na-error">Tag number is required.</span> }
          </div>
          <na-button variant="cta" type="submit" [loading]="loading()" [disabled]="form.invalid">Track</na-button>
        </form>
      </div>

      @if (error()) {
        <na-alert tone="danger" title="Tracking failed" retryable (retry)="search()">Please try again.</na-alert>
      } @else if (loading()) {
        <na-skeleton [rows]="[1, 2]" height="6rem" />
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

        <section class="status na-card" aria-labelledby="bag-status-h">
          <h2 id="bag-status-h">Current status</h2>
          <div class="status__row">
            <dl class="status__facts">
              <div><dt>Tag</dt><dd class="na-text-mono">{{ b.tagNumber }}</dd></div>
              <div><dt>Type</dt><dd>{{ typeLabel(b) }}</dd></div>
              <div><dt>Pieces</dt><dd>{{ b.pieces }}</dd></div>
              @if (b.weightKg != null) { <div><dt>Weight</dt><dd>{{ b.weightKg }} kg</dd></div> }
            </dl>
            <na-badge [tone]="statusLabel(BAGGAGE_STATUS_MAP, b.status).tone">
              {{ statusLabel(BAGGAGE_STATUS_MAP, b.status).label }}
            </na-badge>
          </div>
        </section>

        <section class="na-card journey" aria-labelledby="bag-journey-h">
          <h2 id="bag-journey-h">Journey</h2>
          <na-timeline [events]="journey()" />
        </section>
      }
    </div>
  `,
  styles: `
    .page { padding: var(--na-space-8) 0 var(--na-space-16); max-width: 720px; }
    .page__head { margin-bottom: var(--na-space-6); }
    .search { padding: var(--na-space-5); margin-bottom: var(--na-space-6); }
    .search__row { display: grid; grid-template-columns: 1fr auto; gap: var(--na-space-4); align-items: end; }
    .status { padding: var(--na-space-5); margin-top: var(--na-space-4); }
    .status h2, .journey h2 { font-size: var(--na-text-lg); margin-bottom: var(--na-space-4); }
    .status__row { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--na-space-4); }
    .status__facts { display: flex; gap: var(--na-space-8); margin: 0; flex-wrap: wrap; }
    .status__facts dt { font-size: var(--na-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--na-ink-500); }
    .status__facts dd { margin: 0; font-weight: var(--na-font-medium); }
    .journey { padding: var(--na-space-5); margin-top: var(--na-space-4); }
    .alert-action { margin-top: var(--na-space-3); }
    @media (max-width: 639px) {
      .search__row { grid-template-columns: 1fr; }
      .status__row { flex-direction: column; }
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

  readonly journey = computed<TimelineEvent[]>(() => {
    const b = this.bag();
    if (!b) return [];
    return [...b.events]
      .sort((a, c) => a.occurredAt.localeCompare(c.occurredAt))
      .map((event) => {
        const status = BAGGAGE_STATUS_MAP[event.eventType as keyof typeof BAGGAGE_STATUS_MAP];
        return {
          label: status?.label ?? event.eventType.replaceAll('_', ' '),
          detail: event.location ?? undefined,
          timestamp: this.dtFmt.format(new Date(event.occurredAt)),
          tone: status?.tone ?? 'info',
        };
      });
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
}
