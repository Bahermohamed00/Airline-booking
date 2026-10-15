import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../../../core/config/api-config';
import type { SupportTicketStatus } from '../../../core/models/domain.model';

export interface TicketPerson {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  /** Customers only — present on ticket payloads so agents can call back. */
  phone?: string | null;
}

export interface AdminTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: SupportTicketStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  customer: TicketPerson;
  assignee: TicketPerson | null;
  lastMessageAt: string;
  unreadCount: number;
}

export type MessageSenderType = 'CUSTOMER' | 'SUPPORT_STAFF';
export type MessageDeliveryStatus = 'NONE' | 'SENT' | 'FAILED';

export interface SupportMessage {
  id: string;
  body: string;
  senderType: MessageSenderType;
  deliveryStatus: MessageDeliveryStatus;
  createdAt: string;
  sender: { id: string; firstName: string; lastName: string } | null;
}

export interface Conversation {
  ticket: AdminTicket;
  messages: SupportMessage[];
}

export interface SupportOverview {
  total: number;
  open: number;
  unreadMessages: number;
  inProgress: number;
  resolved: number;
  closed: number;
}

export interface AdminTicketPage {
  items: AdminTicket[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminTicketQuery {
  status?: SupportTicketStatus;
  ticketNumber?: string;
  email?: string;
  search?: string;
  closedFrom?: string;
  closedTo?: string;
  unreadOnly?: boolean;
  page?: number;
  limit?: number;
}

/** Support Staff ticket API (support:read / support:manage). */
@Injectable({ providedIn: 'root' })
export class AdminSupportService {
  private readonly http = inject(HttpClient);
  private readonly config: ApiConfig = inject(API_CONFIG);

  list(query: AdminTicketQuery = {}): Observable<AdminTicketPage> {
    const params: Record<string, string | number> = { page: query.page ?? 1, limit: query.limit ?? 20 };
    if (query.status) params['status'] = query.status;
    if (query.ticketNumber) params['ticketNumber'] = query.ticketNumber;
    if (query.email) params['email'] = query.email;
    if (query.search) params['search'] = query.search;
    if (query.closedFrom) params['closedFrom'] = query.closedFrom;
    if (query.closedTo) params['closedTo'] = query.closedTo;
    if (query.unreadOnly) params['unreadOnly'] = 'true';
    return this.http.get<AdminTicketPage>(`${this.config.baseUrl}/admin/support/tickets`, { params });
  }

  get(id: string): Observable<AdminTicket> {
    return this.http.get<AdminTicket>(`${this.config.baseUrl}/admin/support/tickets/${id}`);
  }

  overview(): Observable<SupportOverview> {
    return this.http.get<SupportOverview>(`${this.config.baseUrl}/admin/support/overview`);
  }

  conversation(id: string): Observable<Conversation> {
    return this.http.get<Conversation>(`${this.config.baseUrl}/admin/support/tickets/${id}/messages`);
  }

  /** Marks all customer messages on the ticket as read (clears the inbox badge). */
  markRead(id: string): Observable<{ read: number }> {
    return this.http.post<{ read: number }>(`${this.config.baseUrl}/admin/support/tickets/${id}/read`, {});
  }

  reply(id: string, body: string): Observable<SupportMessage> {
    return this.http.post<SupportMessage>(`${this.config.baseUrl}/admin/support/tickets/${id}/replies`, { body });
  }

  private action(id: string, action: 'claim' | 'resolve' | 'close' | 'reopen'): Observable<AdminTicket> {
    return this.http.post<AdminTicket>(`${this.config.baseUrl}/admin/support/tickets/${id}/${action}`, {});
  }

  claim(id: string) { return this.action(id, 'claim'); }
  resolve(id: string) { return this.action(id, 'resolve'); }
  close(id: string) { return this.action(id, 'close'); }
  reopen(id: string) { return this.action(id, 'reopen'); }
}
