import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CustomerSupportService, type SupportTicket } from './support.service';
import { toErrorMessage } from '../../../shared/utils/http-error-message';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { SUPPORT_TICKET_STATUS_MAP, statusLabel } from '../../../core/status-maps';

/**
 * Customer support/complaint form. The customer identity always comes from
 * the authenticated session (JWT) — the form never asks for it. Agent
 * communication happens outside the app; the success state shows the ticket
 * number for reference.
 */
@Component({
  selector: 'app-customer-support',
  standalone: true,
  imports: [FormsModule, RouterLink, NaButton, NaBadge],
  template: `
    <div class="na-container support">
      <header class="support__head">
        <h1>Contact Support</h1>
        <p class="na-text-muted">
          Describe your problem or question — our support team will get back to you by email.
        </p>
      </header>

      @if (submitted(); as ticket) {
        <section class="na-card support__success" aria-live="polite">
          <h2>Request received</h2>
          <p>
            Your support ticket was created successfully. Please keep your ticket number for
            reference:
          </p>
          <p class="support__number na-text-mono">{{ ticket.ticketNumber }}</p>
          <p class="na-text-muted">
            Status: <na-badge [tone]="statusOf(ticket).tone">{{ statusOf(ticket).label }}</na-badge>
            — we will contact you at your account email address.
          </p>
          <div class="support__actions">
            <na-button variant="secondary" (clicked)="reset()">Submit another request</na-button>
            <a routerLink="/help" class="support__back">Back to Help</a>
          </div>
        </section>
      } @else {
        <form class="na-card support__form" (submit)="submit($event)">
          <div class="na-field">
            <label class="na-label" for="ticket-subject">Subject</label>
            <input
              id="ticket-subject"
              class="na-input"
              type="text"
              name="subject"
              [(ngModel)]="subject"
              maxlength="200"
              placeholder="e.g. I cannot log into my account"
              required
            />
          </div>
          <div class="na-field">
            <label class="na-label" for="ticket-description">Describe your problem</label>
            <textarea
              id="ticket-description"
              class="na-input support__textarea"
              name="description"
              rows="7"
              [(ngModel)]="description"
              maxlength="5000"
              placeholder="Tell us what happened, what you expected, and any details that help us assist you…"
              required
            ></textarea>
          </div>
          @if (formError()) {
            <p class="na-error" role="alert">{{ formError() }}</p>
          }
          <div class="support__actions">
            <na-button variant="cta" type="submit" [disabled]="submitting()" [loading]="submitting()">
              Submit request
            </na-button>
            <a routerLink="/help" class="support__back">Back to Help</a>
          </div>
        </form>
      }
    </div>
  `,
  styles: `
    .support { padding: var(--na-space-8) 0 var(--na-space-16); max-width: 720px; }
    .support__head { margin-bottom: var(--na-space-6); }
    .support__head p { margin-top: var(--na-space-2); }
    .support__form { padding: var(--na-space-6); display: flex; flex-direction: column; gap: var(--na-space-4); }
    .support__textarea { resize: vertical; min-height: 140px; font-family: inherit; }
    .support__actions { display: flex; align-items: center; gap: var(--na-space-4); }
    .support__back { font-weight: var(--na-font-semibold); }
    .support__success { padding: var(--na-space-6); display: flex; flex-direction: column; gap: var(--na-space-3); }
    .support__number { font-size: var(--na-text-xl); font-weight: var(--na-font-bold); letter-spacing: 0.06em; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerSupportPage {
  private readonly support = inject(CustomerSupportService);

  subject = '';
  description = '';

  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly submitted = signal<SupportTicket | null>(null);

  statusOf(ticket: SupportTicket) {
    return statusLabel(SUPPORT_TICKET_STATUS_MAP, ticket.status);
  }

  submit(event: Event): void {
    event.preventDefault();
    if (this.submitting()) return;
    const subject = this.subject.trim();
    const description = this.description.trim();
    if (subject.length < 3) {
      this.formError.set('Please enter a subject (at least 3 characters).');
      return;
    }
    if (description.length < 10) {
      this.formError.set('Please describe your problem in a bit more detail (at least 10 characters).');
      return;
    }
    this.formError.set(null);
    this.submitting.set(true);
    this.support.createTicket({ subject, description }).subscribe({
      next: (ticket) => {
        this.submitting.set(false);
        this.submitted.set(ticket);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.formError.set(toErrorMessage(err, 'Could not submit your request. Please try again.'));
      },
    });
  }

  reset(): void {
    this.subject = '';
    this.description = '';
    this.formError.set(null);
    this.submitted.set(null);
  }
}
