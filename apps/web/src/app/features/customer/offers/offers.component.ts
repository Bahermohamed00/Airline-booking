import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { OffersService, type OfferView } from '../../../core/services/offers.service';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';
import { scrollToSection } from '../../../shared/utils/scroll-to-section';

@Component({
  selector: 'na-offers-page',
  imports: [RouterLink, NgOptimizedImage, DatePipe, NaAlert, NaSkeleton, NaEmptyState],
  templateUrl: './offers.component.html',
  styleUrl: './offers.component.css',
})
export class OffersPage {
  private readonly offersService = inject(OffersService);

  protected readonly offers = signal<OfferView[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);

  /**
   * Customer-facing listing shows bookable offers only. `bookable` is the
   * API-authoritative flag (an offer carries discount terms that checkout
   * honours) — marketing-only offers have no booking path, so they are not
   * listed at all. Derived from the response on every load, so admin
   * create/edit/activate/deactivate changes are reflected automatically.
   * Order is preserved from the API response (validFrom desc, title asc).
   */
  protected readonly bookableOffers = computed(() =>
    this.offers().filter((o) => o.bookable === true),
  );

  protected readonly featured = computed(() => this.bookableOffers()[0] ?? null);
  protected readonly regular = computed(() => this.bookableOffers().slice(1));
  protected readonly destinationCount = computed(
    () =>
      new Set(
        this.bookableOffers()
          .map((o) => o.destination)
          .filter((d): d is string => !!d),
      ).size,
  );

  constructor() {
    inject(Title).setTitle('NovaAir — Offers & special fares');
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.offersService.listPublic().subscribe({
      next: (offers) => {
        this.offers.set(offers);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  protected go(target: string, event: Event): void {
    scrollToSection(target, event);
  }
}
