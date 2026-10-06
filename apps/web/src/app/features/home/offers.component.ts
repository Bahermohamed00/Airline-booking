import { Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OFFERS } from './home.data';
import type { Offer } from './home.models';
import { SectionHeader } from './section-header.component';
import { daysFromNow } from './date-input';

@Component({
  selector: 'na-offers',
  imports: [RouterLink, SectionHeader, NgOptimizedImage],
  templateUrl: './offers.component.html',
  styleUrl: './offers.component.css',
})
export class OffersSection {
  protected readonly featured = OFFERS.find((o) => o.featured);
  protected readonly secondary = OFFERS.filter((o) => !o.featured);
  private readonly departDate = daysFromNow(21);

  protected cabinLabel(cabin: string): string {
    return cabin === 'BUSINESS' ? 'Business class' : 'Economy';
  }

  protected cabinOf(o: Offer): string {
    return o.cabin.charAt(0) + o.cabin.slice(1).toLowerCase();
  }

  protected discountOf(o: Offer): string {
    const pct = Math.round((1 - o.price / o.oldPrice) * 100);
    return `−${pct}%`;
  }

  protected cityOf(o: Offer, index: 0 | 1): string {
    return o.routeLabel.split('→')[index]?.trim() ?? '';
  }

  protected paramsFor(o: Offer): Record<string, string | number> {
    return {
      tripType: 'ONE_WAY',
      origin: o.origin,
      destination: o.destination,
      depart: this.departDate,
      adults: 1,
      children: 0,
      infants: 0,
      cabin: o.cabin,
    };
  }
}
