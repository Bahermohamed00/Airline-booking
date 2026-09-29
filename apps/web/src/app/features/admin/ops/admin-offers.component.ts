import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { OffersService, type AdminOffer, type OfferStatus } from '../../../core/services/offers.service';
import { ToastService } from '../../../shared/ui/toast.service';
import type { StatusTone } from '../../../core/status-maps';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';
import { NaDialog } from '../../../shared/ui/dialog.component';

const STATUS_TONE: Record<OfferStatus, StatusTone> = {
  ACTIVE: 'success',
  DRAFT: 'info',
  INACTIVE: 'neutral',
  EXPIRED: 'warning',
};
const STATUSES: OfferStatus[] = ['DRAFT', 'ACTIVE', 'INACTIVE', 'EXPIRED'];

@Component({
  selector: 'na-admin-offers',
  imports: [ReactiveFormsModule, NaBreadcrumbs, NaButton, NaBadge, NaSkeleton, NaEmptyState, NaDialog],
  template: `
    <section class="page">
      <na-breadcrumbs [items]="crumbs" />
      <header class="page__head">
        <div>
          <h1>Offers</h1>
          <p class="page__sub">Marketing offers shown on the public /offers page. Deletion deactivates an offer.</p>
        </div>
        @if (canManage() && !loading()) {
          <na-button variant="cta" (clicked)="openCreate()">New offer</na-button>
        }
      </header>

      @if (!canManage()) {
        <na-empty-state
          icon="🔒"
          title="Access restricted"
          message="You need the offers:manage permission to administer offers. Contact a Super Admin."
        />
      } @else if (loading()) {
        <na-skeleton [rows]="[1, 2, 3]" height="2.5rem" />
      } @else if (loadError()) {
        <div class="list-error" role="alert">
          <p>{{ loadError() }}</p>
          <na-button variant="secondary" (clicked)="load()">Retry</na-button>
        </div>
      } @else {
        <div class="filters">
          <label class="na-label" for="status-filter">Status</label>
          <select id="status-filter" class="na-select" (change)="setFilter($any($event.target).value)">
            <option value="">All statuses</option>
            @for (s of statuses; track s) {
              <option [value]="s" [selected]="filter() === s">{{ s }}</option>
            }
          </select>
        </div>

        @if (offers().length === 0) {
          <na-empty-state icon="✈" title="No offers" message="Create the first marketing offer for the /offers page." />
        } @else {
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Destination</th>
                  <th>Value</th>
                  <th>Status</th>
                  <th>Validity</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (o of offers(); track o.id) {
                  <tr>
                    <td data-label="Title">
                      <div class="title-cell">
                        <strong>{{ o.title }}</strong>
                        @if (o.badge) {
                          <small>{{ o.badge }}</small>
                        }
                      </div>
                    </td>
                    <td data-label="Destination">{{ o.destination ?? '—' }}</td>
                    <td data-label="Value">{{ o.offerValue ?? '—' }}</td>
                    <td data-label="Status">
                      <na-badge [tone]="toneOf(o.status)">{{ o.status }}</na-badge>
                    </td>
                    <td data-label="Validity">{{ dateOf(o.validFrom) }} → {{ dateOf(o.validUntil) }}</td>
                    <td data-label="Actions">
                      <div class="row-actions">
                        <na-button variant="secondary" size="sm" (clicked)="openEdit(o)">Edit</na-button>
                        @if (o.status !== 'INACTIVE') {
                          <na-button variant="danger" size="sm" (clicked)="askDelete(o)">Delete</na-button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }

      @if (drawerOpen()) {
        <div class="backdrop" (click)="closeDrawer()" role="presentation"></div>
        <aside
          class="drawer"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="editing() ? 'Edit offer' : 'New offer'"
          tabindex="-1"
          (keydown.escape)="closeDrawer()"
        >
          <header class="drawer__head">
            <h2>{{ editing() ? 'Edit offer' : 'New offer' }}</h2>
            <button type="button" class="drawer__close" aria-label="Close" (click)="closeDrawer()">×</button>
          </header>
          <form [formGroup]="form" (ngSubmit)="save()">
            <div class="na-field">
              <label class="na-label" for="of-title">Title</label>
              <input id="of-title" class="na-input" formControlName="title" />
              @if (showError('title')) {
                <p class="na-error">Title is required (3–120 characters).</p>
              }
            </div>
            <div class="na-field">
              <label class="na-label" for="of-desc">Description</label>
              <textarea id="of-desc" class="na-input" rows="3" formControlName="description"></textarea>
              @if (showError('description')) {
                <p class="na-error">Description is required (10–600 characters).</p>
              }
            </div>
            <div class="form-grid">
              <div class="na-field">
                <label class="na-label" for="of-badge">Badge <span class="na-hint">(optional)</span></label>
                <input id="of-badge" class="na-input" formControlName="badge" placeholder="e.g. Winter sun" />
              </div>
              <div class="na-field">
                <label class="na-label" for="of-value">Display value <span class="na-hint">(optional)</span></label>
                <input id="of-value" class="na-input" formControlName="offerValue" placeholder="e.g. from €349" />
              </div>
            </div>
            <div class="na-field">
              <label class="na-label" for="of-dest">Destination text <span class="na-hint">(optional)</span></label>
              <input id="of-dest" class="na-input" formControlName="destination" placeholder="e.g. Frankfurt → Dubai" />
            </div>
            <div class="na-field">
              <label class="na-label" for="of-img">Image <span class="na-hint">(assets/… path or https:// URL)</span></label>
              <input id="of-img" class="na-input" formControlName="imageUrl" placeholder="assets/img/dest-dubai.jpg" />
              @if (showError('imageUrl')) {
                <p class="na-error">Use an assets/… path or an https:// URL.</p>
              }
            </div>
            <div class="na-field">
              <label class="na-label" for="of-terms">Terms <span class="na-hint">(optional)</span></label>
              <textarea id="of-terms" class="na-input" rows="2" formControlName="terms"></textarea>
            </div>
            <div class="form-grid">
              <div class="na-field">
                <label class="na-label" for="of-from">Valid from</label>
                <input id="of-from" class="na-input" type="date" formControlName="validFrom" />
                @if (showError('validFrom')) {
                  <p class="na-error">Required.</p>
                }
              </div>
              <div class="na-field">
                <label class="na-label" for="of-until">Valid until</label>
                <input id="of-until" class="na-input" type="date" formControlName="validUntil" />
                @if (showError('validUntil')) {
                  <p class="na-error">Required.</p>
                }
              </div>
            </div>
            @if (rangeError()) {
              <p class="na-error" role="alert">Valid from must be on or before valid until.</p>
            }
            <div class="na-field">
              <label class="na-label" for="of-status">Status</label>
              <select id="of-status" class="na-select" formControlName="status">
                @for (s of statuses; track s) {
                  <option [value]="s">{{ s }}</option>
                }
              </select>
              <p class="na-hint">Only ACTIVE offers inside the validity window appear on /offers.</p>
            </div>
            <div class="drawer__actions">
              <na-button variant="secondary" (clicked)="closeDrawer()">Cancel</na-button>
              <na-button variant="cta" type="submit" [loading]="saving()">{{ editing() ? 'Save changes' : 'Create offer' }}</na-button>
            </div>
          </form>
        </aside>
      }
    </section>

    <na-dialog
      [open]="deleting() !== null"
      title="Delete offer?"
      confirmLabel="Delete offer"
      [confirmDanger]="true"
      (confirmed)="confirmDelete()"
      (cancelled)="deleting.set(null)"
    >
      @if (deleting(); as o) {
        Deleting <strong>{{ o.title }}</strong> deactivates it immediately — it disappears from the public /offers
        page but stays in the catalog history. This action is audit-logged.
      }
    </na-dialog>
  `,
  styles: `
    .page { padding: var(--na-space-6) var(--na-space-6) var(--na-space-12); max-width: 1200px; }
    .page__head { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--na-space-4); margin-bottom: var(--na-space-5); flex-wrap: wrap; }
    .page__sub { color: var(--na-ink-500); margin-top: var(--na-space-1); }
    .filters { display: flex; align-items: center; gap: var(--na-space-3); margin-bottom: var(--na-space-4); max-width: 320px; }
    .list-error { display: flex; align-items: center; gap: var(--na-space-4); padding: var(--na-space-4); border: 1px solid var(--na-danger); border-radius: var(--na-radius-md); color: var(--na-danger); }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: var(--na-text-sm); }
    th { text-align: left; color: var(--na-ink-500); font-size: var(--na-text-xs); font-weight: var(--na-font-semibold); letter-spacing: 0.08em; text-transform: uppercase; padding: var(--na-space-2) var(--na-space-3); border-bottom: 1px solid var(--na-border-strong); }
    td { padding: var(--na-space-3); border-bottom: 1px solid var(--na-border); vertical-align: middle; }
    .title-cell { display: flex; flex-direction: column; gap: 1px; }
    .title-cell small { color: var(--na-ink-500); }
    .row-actions { display: flex; gap: var(--na-space-2); }
    .backdrop { position: fixed; inset: 0; background: var(--na-overlay); z-index: 90; }
    .drawer {
      position: fixed; top: 0; right: 0; bottom: 0; z-index: 100; width: min(460px, 100vw);
      background: var(--na-surface-raised); border-left: 1px solid var(--na-border);
      box-shadow: var(--na-shadow-lg); padding: var(--na-space-6); overflow-y: auto;
    }
    .drawer__head { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--na-space-5); }
    .drawer__close { background: none; border: none; font-size: 1.5rem; color: var(--na-ink-700); min-width: 44px; min-height: 44px; }
    .drawer__actions { display: flex; justify-content: flex-end; gap: var(--na-space-3); margin-top: var(--na-space-4); }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 var(--na-space-4); }
    @media (max-width: 900px) {
      table, thead, tbody, tr, th, td { display: block; }
      thead { display: none; }
      tr { border: 1px solid var(--na-border); border-radius: var(--na-radius-md); margin-bottom: var(--na-space-3); padding: var(--na-space-2); }
      td { border: none; padding: var(--na-space-2) var(--na-space-3); }
      td::before { content: attr(data-label); display: block; font-size: var(--na-text-xs); color: var(--na-ink-500); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px; }
    }
    @media (max-width: 639px) {
      .form-grid { grid-template-columns: 1fr; }
    }
  `,
})
export class AdminOffersPage {
  private readonly auth = inject(AuthService);
  private readonly offersService = inject(OffersService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly crumbs = [
    { label: 'Admin', path: '/admin/dashboard' },
    { label: 'Offers', path: '/admin/offers' },
  ];
  protected readonly statuses = STATUSES;

  protected readonly canManage = computed(() => this.auth.hasPermission('offers:manage'));
  protected readonly offers = signal<AdminOffer[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly filter = signal<OfferStatus | ''>('');
  protected readonly drawerOpen = signal(false);
  protected readonly editing = signal<AdminOffer | null>(null);
  protected readonly deleting = signal<AdminOffer | null>(null);
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(600)]],
    badge: ['', Validators.maxLength(60)],
    offerValue: ['', Validators.maxLength(60)],
    destination: ['', Validators.maxLength(120)],
    imageUrl: ['', Validators.pattern(/^(assets\/[\w./-]+|https:\/\/[\w./?=&%:+~-]+)$/i)],
    terms: ['', Validators.maxLength(600)],
    validFrom: ['', Validators.required],
    validUntil: ['', Validators.required],
    status: ['DRAFT' as OfferStatus, Validators.required],
  });

  constructor() {
    if (this.canManage()) {
      this.load();
    } else {
      this.loading.set(false);
    }
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.offersService.listAdmin(this.filter() || undefined).subscribe({
      next: (offers) => {
        this.offers.set(offers);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set('Could not load offers. Please try again.');
      },
    });
  }

  protected setFilter(value: string): void {
    this.filter.set(value as OfferStatus | '');
    this.load();
  }

  protected toneOf(status: OfferStatus): StatusTone {
    return STATUS_TONE[status];
  }

  protected dateOf(iso: string): string {
    return iso.slice(0, 10);
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset({ status: 'DRAFT', title: '', description: '', badge: '', offerValue: '', destination: '', imageUrl: '', terms: '', validFrom: '', validUntil: '' });
    this.submitted.set(false);
    this.drawerOpen.set(true);
  }

  protected openEdit(offer: AdminOffer): void {
    this.editing.set(offer);
    this.form.reset({
      title: offer.title,
      description: offer.description,
      badge: offer.badge ?? '',
      offerValue: offer.offerValue ?? '',
      destination: offer.destination ?? '',
      imageUrl: offer.imageUrl ?? '',
      terms: offer.terms ?? '',
      validFrom: this.dateOf(offer.validFrom),
      validUntil: this.dateOf(offer.validUntil),
      status: offer.status,
    });
    this.submitted.set(false);
    this.drawerOpen.set(true);
  }

  protected closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  protected showError(control: string): boolean {
    const c = this.form.get(control);
    return !!c && c.invalid && (c.touched || this.submitted());
  }

  protected rangeError(): boolean {
    const { validFrom, validUntil } = this.form.getRawValue();
    return this.submitted() && !!validFrom && !!validUntil && validFrom > validUntil;
  }

  protected save(): void {
    this.submitted.set(true);
    const raw = this.form.getRawValue();
    if (this.form.invalid || (raw.validFrom && raw.validUntil && raw.validFrom > raw.validUntil)) {
      return;
    }
    this.saving.set(true);
    const payload = {
      title: raw.title,
      description: raw.description,
      ...(raw.badge ? { badge: raw.badge } : {}),
      ...(raw.offerValue ? { offerValue: raw.offerValue } : {}),
      ...(raw.destination ? { destination: raw.destination } : {}),
      ...(raw.imageUrl ? { imageUrl: raw.imageUrl } : {}),
      ...(raw.terms ? { terms: raw.terms } : {}),
      validFrom: raw.validFrom,
      validUntil: raw.validUntil,
      status: raw.status,
    };

    const editing = this.editing();
    const request$ = editing
      ? this.offersService.updateAdmin(editing.id, payload)
      : this.offersService.createAdmin(payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.drawerOpen.set(false);
        this.toast.success(editing ? 'Offer updated.' : 'Offer created.');
        this.load();
      },
      error: (err: { status?: number; error?: { message?: string | string[] } }) => {
        this.saving.set(false);
        if (err.status === 409) {
          this.toast.error('An offer with this title already exists.');
        } else if (err.status === 400) {
          const msg = err.error?.message;
          this.toast.error(Array.isArray(msg) ? msg.join(' ') : (msg ?? 'Validation failed.');
        } else {
          this.toast.error('Could not save the offer. Please try again.');
        }
      },
    });
  }

  protected askDelete(offer: AdminOffer): void {
    this.deleting.set(offer);
  }

  protected confirmDelete(): void {
    const offer = this.deleting();
    if (!offer) return;
    this.offersService.deleteAdmin(offer.id).subscribe({
      next: () => {
        this.deleting.set(null);
        this.toast.success('Offer deactivated.');
        this.load();
      },
      error: () => {
        this.deleting.set(null);
        this.toast.error('Could not delete the offer.');
      },
    });
  }
}
