import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../config/api-config';

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
}

export type OfferStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'EXPIRED';

/** Admin offer shape (adds lifecycle fields). */
export interface AdminOffer extends OfferView {
  status: OfferStatus;
  createdAt: string;
  updatedAt: string;
}

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
}
