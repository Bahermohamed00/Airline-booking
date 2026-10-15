import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../../../core/config/api-config';
import type { SupportTicketStatus } from '../../../core/models/domain.model';

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  status: SupportTicketStatus;
  createdAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
}

export interface CreateTicketPayload {
  subject: string;
  description: string;
}

/** Customer-facing support tickets (POST submit, own-ticket history). */
@Injectable({ providedIn: 'root' })
export class CustomerSupportService {
  private readonly http = inject(HttpClient);
  private readonly config: ApiConfig = inject(API_CONFIG);

  createTicket(payload: CreateTicketPayload): Observable<SupportTicket> {
    return this.http.post<SupportTicket>(`${this.config.baseUrl}/support/tickets`, payload);
  }

  myTickets(): Observable<SupportTicket[]> {
    return this.http.get<SupportTicket[]>(`${this.config.baseUrl}/support/tickets/mine`);
  }
}
