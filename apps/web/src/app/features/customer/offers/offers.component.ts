import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, NgOptimizedImage } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
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
  private readonly router = inject(Router);

  protected readonly offers = signal<OfferView[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);

  protected readonly featured = computed(() => this.offers()[0] ?? null);
  protected readonly regular = computed(() => this.offers().slice(1));
  protected readonly destinationCount = computed(
    () =>
      new Set(
        this.offers()
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

  protected go2search(): void {
    this.router.navigateByUrl('/search');
  }
}
