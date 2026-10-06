import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import {
  OffersService,
  type AdminOffer,
  type OfferStatus,
} from '../../../core/services/offers.service';
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
  imports: [
    ReactiveFormsModule,
    NaBreadcrumbs,
    NaButton,
    NaBadge,
    NaSkeleton,
    NaEmptyState,
    NaDialog,
  ],
  templateUrl: './admin-offers.component.html',
  styleUrl: './admin-offers.component.css',
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
    this.form.reset({
      status: 'DRAFT',
      title: '',
      description: '',
      badge: '',
      offerValue: '',
      destination: '',
      imageUrl: '',
      terms: '',
      validFrom: '',
      validUntil: '',
    });
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
          this.toast.error(Array.isArray(msg) ? msg.join(' ') : (msg ?? 'Validation failed.'));
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
