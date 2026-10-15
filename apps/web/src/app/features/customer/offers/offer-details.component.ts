import { Component, inject, signal } from '@angular/core';
import { DatePipe, NgOptimizedImage } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OffersService, type OfferView } from '../../../core/services/offers.service';
import { formatMoney } from '../../../core/services/pricing.service';
import type { CabinClass } from '../../../core/models/domain.model';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';

function cabinLabel(c: CabinClass): string {
  return c
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * BR-16 offer detail page. Bookable offers deep-link into the booking funnel:
 * the Book Now CTA carries the offerId (plus any eligibility prefill) to
 * /results; the backend stays the sole judge of eligibility and pricing.
 */
@Component({
  selector: 'na-offer-details-page',
  imports: [RouterLink, NgOptimizedImage, DatePipe, NaAlert, NaSkeleton, NaEmptyState],
  templateUrl: './offer-details.component.html',
  styleUrl: './offer-details.component.css',
})
export class OfferDetailsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly offersService = inject(OffersService);
  private readonly title = inject(Title);

  /** undefined = loading, null = not found */
  protected readonly offer = signal<OfferView | null | undefined>(undefined);
  protected readonly loadError = signal(false);

  /** Same default the search page uses: tomorrow. */
  private readonly defaultDepart = toDateInput(new Date(Date.now() + 86400000));

  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed())
      .subscribe((params) => this.load(params.get('id') ?? ''));
  }

  protected retry(): void {
    this.load(this.route.snapshot.paramMap.get('id') ?? '');
  }

  private load(id: string): void {
    this.offer.set(undefined);
    this.loadError.set(false);
    this.offersService.getPublic(id).subscribe({
      next: (offer) => {
        this.offer.set(offer ?? null);
        if (offer) this.title.setTitle(`NovaAir — ${offer.title}`);
      },
      error: (err: { status?: number }) => {
        if (err?.status === 404) this.offer.set(null);
        else this.loadError.set(true);
      },
    });
  }

  protected discountLabel(o: OfferView): string {
    const d = o.discount;
    if (!d) return '';
    return d.type === 'PERCENT' ? `${d.value}% off` : `${formatMoney(d.value, 'EUR')} off`;
  }

  protected routeLabel(o: OfferView): string {
    const e = o.eligibility;
    return e?.originIata && e?.destinationIata
      ? `${e.originIata} → ${e.destinationIata}`
      : 'All routes';
  }

  protected cabinLabelOf(o: OfferView): string {
    return o.eligibility?.cabinClass ? cabinLabel(o.eligibility.cabinClass) : 'All cabins';
  }

  /**
   * Mirrors the home page paramsFor prefill pattern: a restricted offer
   * prefills a full one-way search on /results; an unrestricted offer carries
   * only the offerId and lets the customer search normally.
   */
  protected bookParams(o: OfferView): Record<string, string | number> {
    const e = o.eligibility;
    const params: Record<string, string | number> = { offerId: o.id };
    if (e?.originIata && e?.destinationIata) {
      params['tripType'] = 'ONE_WAY';
      params['origin'] = e.originIata;
      params['destination'] = e.destinationIata;
      params['depart'] = this.defaultDepart;
      params['adults'] = 1;
      params['children'] = 0;
      params['infants'] = 0;
    }
    if (e?.cabinClass) params['cabin'] = e.cabinClass;
    return params;
  }

  /**
   * Restricted offers can prefill /results directly. Unrestricted offers go to
   * /search instead — /results needs origin/destination/depart, and the search
   * page carries the offerId forward into whatever search the customer makes.
   */
  protected bookCommands(o: OfferView): string[] {
    const e = o.eligibility;
    return e?.originIata && e?.destinationIata ? ['/results'] : ['/search'];
  }

  protected goOffers(): void {
    this.router.navigateByUrl('/offers');
  }
}
