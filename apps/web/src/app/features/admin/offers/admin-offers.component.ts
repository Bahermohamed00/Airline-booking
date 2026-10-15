import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import {
  OffersService,
  type AdminOffer,
  type OfferDiscountType,
  type OfferLifecycleStatus,
  type OfferMode,
  type OfferStatus,
} from '../../../core/services/offers.service';
import { CatalogService } from '../catalog/catalog.service';
import { ToastService } from '../../../shared/ui/toast.service';
import type { CabinClass, Route } from '../../../core/models/domain.model';
import type { StatusTone } from '../../../core/status-maps';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';
import { NaDialog } from '../../../shared/ui/dialog.component';

/** Tone for the derived lifecycle badge (distinct from the stored status). */
const LIFECYCLE_TONE: Record<OfferLifecycleStatus, StatusTone> = {
  ACTIVE: 'success',
  SCHEDULED: 'info',
  DRAFT: 'neutral',
  INACTIVE: 'neutral',
  EXPIRED: 'warning',
};
const LIFECYCLE_LABEL: Record<OfferLifecycleStatus, string> = {
  ACTIVE: 'Active',
  SCHEDULED: 'Scheduled',
  DRAFT: 'Draft',
  INACTIVE: 'Inactive',
  EXPIRED: 'Expired',
};
/** Why an offer with valid discount terms is not currently bookable. */
const NOT_BOOKABLE_REASON: Record<OfferLifecycleStatus, string | null> = {
  ACTIVE: null,
  SCHEDULED: 'Valid from a future date',
  DRAFT: 'Never published',
  INACTIVE: 'Deactivated by staff',
  EXPIRED: 'Validity period has ended',
};

const STATUSES: OfferStatus[] = ['DRAFT', 'ACTIVE', 'INACTIVE', 'EXPIRED'];
const CABIN_CLASSES: CabinClass[] = ['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'];

function cabinLabel(c: CabinClass): string {
  return c
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

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
  private readonly catalog = inject(CatalogService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly crumbs = [
    { label: 'Admin', path: '/admin/dashboard' },
    { label: 'Offers', path: '/admin/offers' },
  ];
  protected readonly statuses = STATUSES;
  protected readonly cabins = CABIN_CLASSES;

  /** Documented so the filter's semantics stay unambiguous in the UI. */
  protected readonly filterHint =
    'Filters on the stored status, not the displayed lifecycle status. "All statuses" shows every offer, including expired ones.';

  /**
   * Current offer type, so the template can reveal/hide the terms block.
   * A plain getter, not a computed: reactive-form control values are not
   * signals, so a computed would never invalidate and the block would freeze.
   */
  protected get mode(): OfferMode {
    return this.form.controls.mode.value;
  }

  protected readonly canManage = computed(() => this.auth.hasPermission('offers:manage'));
  protected readonly offers = signal<AdminOffer[]>([]);
  protected readonly routes = signal<Route[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly filter = signal<OfferStatus | ''>('');
  protected readonly drawerOpen = signal(false);
  protected readonly editing = signal<AdminOffer | null>(null);
  protected readonly deleting = signal<AdminOffer | null>(null);
  protected readonly deletingPermanently = signal<AdminOffer | null>(null);
  protected readonly saving = signal(false);
  protected readonly submitted = signal(false);

  /** Tracks the discount-type select so the value input can be conditional. */
  protected readonly discountTypeSel = signal<'' | OfferDiscountType>('');
  protected readonly discountValueError = signal<string | null>(null);

  /**
   * Mode selected before the last change, used to detect a Bookable →
   * Marketing-only switch. A pending switch is only applied on confirmation,
   * so cancelling leaves every form value untouched.
   */
  private readonly modeBeforeChange = signal<OfferMode | null>(null);
  protected readonly clearingTerms = signal(false);

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
    mode: ['marketing' as OfferMode],
    discountType: ['' as '' | OfferDiscountType],
    routeId: [''],
    cabinClass: ['' as '' | CabinClass],
    discountValue: [null as number | null],
  });

  constructor() {
    this.form.controls.discountType.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((v) => {
        this.discountTypeSel.set(v);
        this.discountValueError.set(null);
      });
    this.form.controls.mode.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((next) => this.onModeChanged(next));
    if (this.canManage()) {
      this.load();
      this.catalog.listRoutes().subscribe({
        next: (routes) => this.routes.set(routes),
        error: () => this.routes.set([]),
      });
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

  /**
   * Display lifecycle — derived server-side from the stored status and the
   * validity window, so an ACTIVE offer past its validUntil reads "Expired"
   * without the stored status (or the row) being changed.
   */
  protected lifecycleLabel(offer: AdminOffer): string {
    return LIFECYCLE_LABEL[offer.lifecycleStatus];
  }

  protected lifecycleTone(offer: AdminOffer): StatusTone {
    return LIFECYCLE_TONE[offer.lifecycleStatus];
  }

  /**
   * Bookability is deliberately separate from lifecycle. Valid discount terms
   * on an expired, scheduled, draft or inactive offer are historical records,
   * not a live booking promise — so those never read as simply "Bookable".
   */
  protected isBookableNow(offer: AdminOffer): boolean {
    return offer.bookable && offer.lifecycleStatus === 'ACTIVE';
  }

  protected bookabilityLabel(offer: AdminOffer): string {
    if (!offer.bookable) return 'Marketing-only';
    return this.isBookableNow(offer) ? 'Bookable' : 'Terms set — not bookable';
  }

  protected bookabilityTone(offer: AdminOffer): StatusTone {
    if (!offer.bookable) return 'neutral';
    return this.isBookableNow(offer) ? 'success' : 'warning';
  }

  /** Null when the offer is genuinely bookable; otherwise why it is not. */
  protected bookabilityNote(offer: AdminOffer): string | null {
    if (!offer.bookable || this.isBookableNow(offer)) return null;
    return NOT_BOOKABLE_REASON[offer.lifecycleStatus];
  }

  protected dateOf(iso: string): string {
    return iso.slice(0, 10);
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.modeBeforeChange.set('marketing');
    this.clearingTerms.set(false);
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
      mode: 'marketing',
      discountType: '',
      discountValue: null,
      routeId: '',
      cabinClass: '',
    });
    this.discountTypeSel.set('');
    this.discountValueError.set(null);
    this.submitted.set(false);
    this.drawerOpen.set(true);
  }

  /**
   * Opens the drawer fully populated from the admin response. `discount` and
   * `eligibility` now come from GET /admin/offers, so an existing offer's
   * real terms load into the form and the mode follows the backend invariant
   * (valid discount pair ⇒ bookable, otherwise marketing-only).
   */
  protected openEdit(offer: AdminOffer): void {
    this.editing.set(offer);
    const mode: OfferMode = offer.discount ? 'bookable' : 'marketing';
    this.modeBeforeChange.set(mode);
    this.clearingTerms.set(false);
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
      mode,
      discountType: offer.discount?.type ?? '',
      discountValue: offer.discount?.value ?? null,
      routeId: offer.eligibility?.routeId ?? '',
      cabinClass: offer.eligibility?.cabinClass ?? '',
    });
    this.discountTypeSel.set(offer.discount?.type ?? '');
    this.discountValueError.set(null);
    this.submitted.set(false);
    this.drawerOpen.set(true);
  }

  /** True when the offer being edited already carries discount/scope terms. */
  private editingHasTerms(): boolean {
    const o = this.editing();
    return !!o && (!!o.discount || !!o.eligibility?.routeId || !!o.eligibility?.cabinClass);
  }

  /**
   * Bookable → Marketing-only drops terms that the backend cannot keep while
   * the offer is marketing-only, so it is confirmed rather than applied
   * silently. The switch is held pending until confirmed; cancelling restores
   * the previous mode and leaves every other form value as the admin left it.
   */
  private onModeChanged(next: OfferMode): void {
    const previous = this.modeBeforeChange();
    if (previous === null || previous === next) return;
    if (previous === 'bookable' && next === 'marketing') {
      this.clearingTerms.set(true);
      return; // applied only by confirmClearTerms()
    }
    this.modeBeforeChange.set(next);
  }

  protected confirmClearTerms(): void {
    this.clearingTerms.set(false);
    this.modeBeforeChange.set('marketing');
    this.form.controls.mode.setValue('marketing', { emitEvent: false });
    this.discountTypeSel.set('');
    this.discountValueError.set(null);
  }

  protected cancelClearTerms(): void {
    this.clearingTerms.set(false);
    // Put the previously selected mode back without touching anything else.
    const previous = this.modeBeforeChange() ?? 'bookable';
    this.form.controls.mode.setValue(previous, { emitEvent: false });
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

  protected cabinName(c: CabinClass): string {
    return cabinLabel(c);
  }

  protected routeOptionLabel(r: Route): string {
    return `${r.origin.iataCode} → ${r.destination.iataCode}`;
  }

  /** Client hints mirroring the server rules; the backend stays authoritative. */
  private validateDiscount(type: '' | OfferDiscountType, value: number | null): number | null {
    if (!type) return null;
    if (value === null || Number.isNaN(value)) {
      this.discountValueError.set('Enter a discount value.');
      return null;
    }
    if (type === 'PERCENT' && (value <= 0 || value > 100)) {
      this.discountValueError.set('Percentage must be greater than 0 and at most 100.');
      return null;
    }
    if (type === 'FIXED_AMOUNT' && value <= 0) {
      this.discountValueError.set('Fixed amount must be greater than 0.');
      return null;
    }
    this.discountValueError.set(null);
    return value;
  }

  protected save(): void {
    this.submitted.set(true);
    const raw = this.form.getRawValue();
    if (this.form.invalid || (raw.validFrom && raw.validUntil && raw.validFrom > raw.validUntil)) {
      return;
    }
    // A pending Bookable → Marketing-only switch is never saved implicitly.
    if (this.clearingTerms()) {
      return;
    }
    const bookable = raw.mode === 'bookable';
    const discountValue = this.validateDiscount(raw.discountType, raw.discountValue);
    // Bookable requires explicit, valid terms — the existing business ranges,
    // mirrored from assertValidDiscount() and re-checked server-side.
    if (bookable && (!raw.discountType || discountValue === null)) {
      return;
    }
    this.saving.set(true);
    const editing = this.editing();
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
      // Mode is expressed purely through these fields — there is no persisted
      // mode column. PATCH semantics: omitted = keep, explicit null = clear.
      //
      //  • Bookable  → send the validated terms. Scope is sent as an explicit
      //    null when left on "All routes"/"All cabins", which is how an admin
      //    clears an existing scope.
      //  • Marketing-only → explicit nulls whenever the edited offer actually
      //    has terms, so nothing is silently left behind. An offer that never
      //    had terms sends nothing (keeping "leave unchanged" semantics).
      ...(bookable
        ? {
            discountType: raw.discountType as OfferDiscountType,
            discountValue,
            routeId: raw.routeId || null,
            cabinClass: raw.cabinClass || null,
          }
        : this.editingHasTerms()
          ? { discountType: null, discountValue: null, routeId: null, cabinClass: null }
          : {}),
    };

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

  protected askPermanentDelete(offer: AdminOffer): void {
    this.deletingPermanently.set(offer);
  }

  protected confirmPermanentDelete(): void {
    const offer = this.deletingPermanently();
    if (!offer) return;
    this.offersService.deletePermanentAdmin(offer.id).subscribe({
      next: () => {
        this.deletingPermanently.set(null);
        this.toast.success('Offer permanently deleted.');
        this.load();
      },
      error: (err: { status?: number; error?: { code?: string; bookingCount?: number } }) => {
        this.deletingPermanently.set(null);
        if (err?.status === 409 && err?.error?.code === 'OFFER_IN_USE') {
          const count = err.error.bookingCount;
          const referenced =
            count != null
              ? `referenced by ${count} existing booking${count === 1 ? '' : 's'}`
              : 'referenced by existing bookings';
          this.toast.error(
            `This offer cannot be permanently deleted because it is ${referenced}. You can deactivate it instead.`,
          );
        } else {
          this.toast.error('Could not delete the offer.');
        }
      },
    });
  }
}
