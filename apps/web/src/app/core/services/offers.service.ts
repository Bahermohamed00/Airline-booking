import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../config/api-config';
import type { CabinClass } from '../models/domain.model';

export type OfferDiscountType = 'PERCENT' | 'FIXED_AMOUNT';

/** Bookable discount terms; null for marketing-only offers. */
export interface OfferDiscount {
  type: OfferDiscountType;
  value: number;
}

/** Eligibility scope of a bookable offer; every null means unrestricted. */
export interface OfferEligibility {
  routeId: string | null;
  originIata: string | null;
  destinationIata: string | null;
  cabinClass: CabinClass | null;
}

/** Customer-facing offer shape from GET /api/offers (presentation fields only). */
export interface OfferView {
  id: string;
  title: string;
  description: string;
  badge: string | null;
  destination: string | null;
  offerValue: string | null;
  terms: string | null;
  imageUrl: string | null;
  validFrom: string;
  validUntil: string;
  /** BR-16: true only when the offer carries a usable discount. */
  bookable: boolean;
  discount: OfferDiscount | null;
  eligibility: OfferEligibility | null;
}

export type OfferStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'EXPIRED';

/**
 * Derived, display-only admin lifecycle state from `GET /admin/offers`.
 * Distinct from OfferStatus: SCHEDULED is never persisted, and an ACTIVE
 * offer whose validity window has closed is shown as EXPIRED. Computed
 * server-side with the same UTC date semantics as the public visibility
 * filter so the admin list cannot disagree with the customer site.
 */
export type OfferLifecycleStatus = 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'EXPIRED' | 'INACTIVE';

/** Admin offer shape (raw persisted status plus the derived fields). */
export interface AdminOffer extends OfferView {
  status: OfferStatus;
  /** What the admin list displays; raw `status` is unchanged. */
  lifecycleStatus: OfferLifecycleStatus;
  /** Valid discount terms exist — not a claim that the offer is bookable today. */
  bookable: boolean;
  /**
   * Raw persisted bookable columns. GET /admin/offers returns the whole row
   * alongside the derived view above; these remain the source of truth, and
   * an out-of-range or half-configured pair shows up here even though
   * `discount` is null.
   */
  discountType?: OfferDiscountType | null;
  discountValue?: number | null;
  routeId?: string | null;
  cabinClass?: CabinClass | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create/Edit offer type. Not a persisted column: the backend's existing
 * invariant decides it — a valid discount type/value pair means Bookable,
 * no pair means Marketing-only. Switching modes is expressed by sending (or
 * explicitly nulling) the discount and eligibility fields on the PATCH.
 */
export type OfferMode = 'bookable' | 'marketing';

export interface OfferInput {
  title: string;
  description: string;
  badge?: string;
  destination?: string;
  offerValue?: string;
  terms?: string;
  imageUrl?: string;
  status?: OfferStatus;
  validFrom: string;
  validUntil: string;
  /** BR-16 bookable terms — discountType/discountValue must be sent together.
   *  On PATCH, explicit null clears (None → marketing-only); omitted = keep. */
  discountType?: OfferDiscountType | null;
  discountValue?: number | null;
  routeId?: string | null;
  cabinClass?: CabinClass | null;
}

@Injectable({ providedIn: 'root' })
export class OffersService {
  private readonly http = inject(HttpClient);
  private readonly config: ApiConfig = inject(API_CONFIG);

  listPublic(): Observable<OfferView[]> {
    return this.http.get<OfferView[]>(`${this.config.baseUrl}/offers`);
  }

  getPublic(id: string): Observable<OfferView> {
    return this.http.get<OfferView>(`${this.config.baseUrl}/offers/${id}`);
  }

  listAdmin(status?: OfferStatus): Observable<AdminOffer[]> {
    return this.http.get<AdminOffer[]>(`${this.config.baseUrl}/admin/offers`, {
      params: status ? { status } : {},
    });
  }

  createAdmin(input: OfferInput): Observable<AdminOffer> {
    return this.http.post<AdminOffer>(`${this.config.baseUrl}/admin/offers`, input);
  }

  updateAdmin(id: string, input: Partial<OfferInput>): Observable<AdminOffer> {
    return this.http.patch<AdminOffer>(`${this.config.baseUrl}/admin/offers/${id}`, input);
  }

  deleteAdmin(id: string): Observable<AdminOffer> {
    return this.http.delete<AdminOffer>(`${this.config.baseUrl}/admin/offers/${id}`);
  }

  /** Permanent removal — 409 OFFER_IN_USE when bookings reference the offer. */
  deletePermanentAdmin(id: string): Observable<AdminOffer> {
    return this.http.delete<AdminOffer>(`${this.config.baseUrl}/admin/offers/${id}/permanent`);
  }
}
