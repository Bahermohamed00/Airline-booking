import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminSupportPage } from './support.component';
import {
  AdminSupportService,
  type AdminTicket,
  type AdminTicketPage,
  type Conversation,
  type SupportMessage,
} from './admin-support.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/ui/toast.service';

const CUSTOMER = { id: 'u-1', firstName: 'Lena', lastName: 'Hoffmann', email: 'lena@example.com' };
const AGENT = { id: 'ag-1', firstName: 'Ada', lastName: 'Agent', email: 'ada@novaair.dev' };

function ticket(partial: Partial<AdminTicket> = {}): AdminTicket {
  return {
    id: 't-1',
    ticketNumber: 'NT7K2P9Q',
    subject: 'Cannot log in',
    description: 'My password stopped working today.',
    status: 'OPEN',
    createdAt: '2026-10-07T08:00:00Z',
    updatedAt: '2026-10-07T08:00:00Z',
    resolvedAt: null,
    closedAt: null,
    customer: CUSTOMER,
    assignee: null,
    lastMessageAt: '2026-10-07T08:00:00Z',
    unreadCount: 1,
    ...partial,
  };
}

const OPENING_MESSAGE: SupportMessage = {
  id: 'm-1',
  body: 'My password stopped working today.',
  senderType: 'CUSTOMER',
  deliveryStatus: 'NONE',
  createdAt: '2026-10-07T08:00:00Z',
  sender: { id: 'u-1', firstName: 'Lena', lastName: 'Hoffmann' },
};

const STAFF_REPLY: SupportMessage = {
  id: 'm-2',
  body: 'We reset your password.',
  senderType: 'SUPPORT_STAFF',
  deliveryStatus: 'SENT',
  createdAt: '2026-10-07T09:00:00Z',
  sender: { id: 'ag-1', firstName: 'Ada', lastName: 'Agent' },
};

function conversation(t: AdminTicket, messages: SupportMessage[] = [OPENING_MESSAGE]): Conversation {
  return { ticket: t, messages };
}

function page(partial: Partial<AdminTicketPage> = {}): AdminTicketPage {
  return { items: [ticket()], page: 1, limit: 20, total: 1, totalPages: 1, ...partial };
}

function mocks(result: AdminTicketPage = page()) {
  return {
    service: {
      list: vi.fn().mockReturnValue(of(result)),
      overview: vi.fn().mockReturnValue(of({ total: 1, open: 1, unreadMessages: 1, inProgress: 0, resolved: 0, closed: 0 })),
      conversation: vi.fn().mockReturnValue(of(conversation(ticket()))),
      markRead: vi.fn().mockReturnValue(of({ read: 1 })),
      reply: vi.fn().mockReturnValue(of(STAFF_REPLY)),
      claim: vi.fn().mockReturnValue(of(ticket({ status: 'IN_PROGRESS', assignee: AGENT }))),
      resolve: vi.fn().mockReturnValue(of(ticket({ status: 'RESOLVED', assignee: AGENT, resolvedAt: '2026-10-07T10:00:00Z' }))),
      close: vi.fn().mockReturnValue(of(ticket({ status: 'CLOSED' }))),
      reopen: vi.fn().mockReturnValue(of(ticket({ status: 'OPEN' }))),
    },
    auth: { hasPermission: vi.fn().mockReturnValue(true) },
    toast: { success: vi.fn(), error: vi.fn() },
  };
}

type Mocks = ReturnType<typeof mocks>;

async function setup(m: Mocks): Promise<ComponentFixture<AdminSupportPage>> {
  await TestBed.configureTestingModule({
    imports: [AdminSupportPage],
    providers: [
      provideRouter([]),
      { provide: AdminSupportService, useValue: m.service },
      { provide: AuthService, useValue: m.auth },
      { provide: ToastService, useValue: m.toast },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(AdminSupportPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

async function openDetail(fixture: ComponentFixture<AdminSupportPage>): Promise<HTMLElement> {
  const el = fixture.nativeElement as HTMLElement;
  el.querySelector<HTMLElement>('na-data-table tbody tr')!.click();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return el;
}

describe('AdminSupportPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads the inbox and renders ticket, customer, email, subject, status and unread badge', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(m.service.list).toHaveBeenCalledWith({ status: undefined, ticketNumber: undefined, email: undefined, page: 1, limit: 20 });
    expect(el.textContent).toContain('NT7K2P9Q');
    expect(el.textContent).toContain('Lena Hoffmann');
    expect(el.textContent).toContain('lena@example.com');
    expect(el.textContent).toContain('Cannot log in');
    expect(el.textContent).toContain('Open');
    expect(el.textContent).toContain('● 1'); // WhatsApp-style unread indicator
  });

  it('hides the unread badge when there are no unread messages', async () => {
    const m = mocks(page({ items: [ticket({ unreadCount: 0 })] }));
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).not.toContain('●');
  });

  it('sends status/ticket-number/email filters to the API', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;
    m.service.list.mockClear();

    const statusSelect = el.querySelector<HTMLSelectElement>('#filter-status')!;
    statusSelect.value = 'OPEN';
    statusSelect.dispatchEvent(new Event('change'));
    const numberInput = el.querySelector<HTMLInputElement>('#filter-number')!;
    numberInput.value = 'NT7K';
    numberInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(m.service.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'OPEN', ticketNumber: 'NT7K', page: 1 }),
    );
  });

  it('the Unread toggle sends unreadOnly=true to the API and All returns to the normal inbox', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;
    m.service.list.mockClear();

    const buttons = [...el.querySelectorAll<HTMLElement>('.inbox-toggle__btn')];
    buttons.find((b) => b.textContent!.trim() === 'Unread')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(m.service.list).toHaveBeenLastCalledWith(expect.objectContaining({ unreadOnly: true, page: 1 }));

    buttons.find((b) => b.textContent!.trim() === 'All')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(m.service.list).toHaveBeenLastCalledWith(expect.objectContaining({ unreadOnly: undefined }));
  });

  it('opens the conversation, shows ticket details, marks messages read, and refreshes the list', async () => {
    const m = mocks();
    const fixture = await setup(m);
    m.service.list.mockClear();
    const el = await openDetail(fixture);

    const modal = el.querySelector('.ticket-modal')!;
    expect(modal.textContent).toContain('My password stopped working today.'); // description
    expect(modal.textContent).toContain('lena@example.com');
    expect(modal.textContent).toContain('Unassigned');

    // Conversation: incoming customer message rendered.
    const incoming = modal.querySelector('.message--incoming')!;
    expect(incoming.textContent).toContain('Lena Hoffmann (customer)');
    expect(incoming.textContent).toContain('My password stopped working today.');

    // Opening marks read → badge would clear; list reloads.
    expect(m.service.markRead).toHaveBeenCalledWith('t-1');
    expect(m.service.list).toHaveBeenCalled();
  });

  it('sends a reply email: composer posts the body, appends the outgoing message, and confirms', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openDetail(fixture);
    const modal = el.querySelector('.ticket-modal')!;

    const textarea = modal.querySelector<HTMLTextAreaElement>('#reply-body')!;
    textarea.value = 'We reset your password.';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const sendBtn = [...modal.querySelectorAll<HTMLElement>('.composer na-button button')].find((b) =>
      b.textContent!.includes('Send Email'),
    )!;
    sendBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.service.reply).toHaveBeenCalledWith('t-1', 'We reset your password.');
    expect(m.toast.success).toHaveBeenCalledWith('Reply emailed to lena@example.com.');
    const outgoing = el.querySelector('.ticket-modal .message--outgoing')!;
    expect(outgoing.textContent).toContain('Ada Agent (support)');
    expect(outgoing.textContent).toContain('emailed');
    expect(outgoing.textContent).toContain('We reset your password.');
  });

  it('disables Send while the composer is empty and hides the composer for CLOSED tickets', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openDetail(fixture);
    const sendBtn = [...el.querySelectorAll<HTMLButtonElement>('.composer na-button button')].find((b) =>
      b.textContent!.includes('Send Email'),
    )!;
    expect(sendBtn.disabled).toBe(true);

    TestBed.resetTestingModule();
    const m2 = mocks();
    m2.service.conversation.mockReturnValue(of(conversation(ticket({ status: 'CLOSED' }))));
    const fixture2 = await setup(m2);
    await openDetail(fixture2);
    expect(fixture2.nativeElement.querySelector('.composer')).toBeNull();
  });

  it('surfaces email-send failures inline without losing the composer state', async () => {
    const m = mocks();
    m.service.reply.mockReturnValue(throwError(() => new Error('smtp down')));
    const fixture = await setup(m);
    const el = await openDetail(fixture);
    const modal = el.querySelector('.ticket-modal')!;

    const textarea = modal.querySelector<HTMLTextAreaElement>('#reply-body')!;
    textarea.value = 'We reset your password.';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    [...modal.querySelectorAll<HTMLElement>('.composer na-button button')]
      .find((b) => b.textContent!.includes('Send Email'))!
      .click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(modal.textContent).toContain('the email could not be sent');
    expect(m.toast.success).not.toHaveBeenCalled();
  });

  it('offers resolve for IN_PROGRESS and close/reopen for RESOLVED, nothing for CLOSED', async () => {
    const m = mocks();
    m.service.conversation.mockReturnValue(of(conversation(ticket({ status: 'IN_PROGRESS', assignee: AGENT }))));
    const fixture = await setup(m);
    let el = await openDetail(fixture);
    expect(el.querySelector('.ticket-modal')!.textContent).toContain('Mark as resolved');
    expect(el.querySelector('.ticket-modal')!.textContent).not.toContain('Close ticket');

    TestBed.resetTestingModule();
    const m2 = mocks();
    m2.service.conversation.mockReturnValue(of(conversation(ticket({ status: 'RESOLVED', assignee: AGENT }))));
    const fixture2 = await setup(m2);
    el = await openDetail(fixture2);
    expect(el.querySelector('.ticket-modal')!.textContent).toContain('Close ticket');
    expect(el.querySelector('.ticket-modal')!.textContent).toContain('Reopen');

    TestBed.resetTestingModule();
    const m3 = mocks();
    m3.service.conversation.mockReturnValue(of(conversation(ticket({ status: 'CLOSED' }))));
    const fixture3 = await setup(m3);
    el = await openDetail(fixture3);
    expect(el.querySelector('.ticket-actions')).toBeNull();
  });

  it('claims an unassigned OPEN ticket from the detail view', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openDetail(fixture);
    const modal = el.querySelector('.ticket-modal')!;

    const claimBtn = [...modal.querySelectorAll<HTMLElement>('.ticket-actions na-button button')].find((b) =>
      b.textContent!.includes('Claim ticket'),
    )!;
    claimBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.service.claim).toHaveBeenCalledWith('t-1');
    expect(m.toast.success).toHaveBeenCalledWith('Ticket NT7K2P9Q: In progress.');
    expect(el.querySelector('.ticket-modal')!.textContent).toContain('Ada Agent');
  });

  it('hides lifecycle actions and the composer without the support:manage permission', async () => {
    const m = mocks();
    m.auth.hasPermission.mockImplementation((p: string) => p !== 'support:manage');
    const fixture = await setup(m);
    const el = await openDetail(fixture);

    expect(el.querySelector('.ticket-actions')).toBeNull();
    expect(el.querySelector('.composer')).toBeNull();
  });

  it('surfaces action errors inline', async () => {
    const m = mocks();
    m.service.claim.mockReturnValue(throwError(() => new Error('conflict')));
    const fixture = await setup(m);
    const el = await openDetail(fixture);

    const claimBtn = [...el.querySelectorAll<HTMLElement>('.ticket-actions na-button button')].find((b) =>
      b.textContent!.includes('Claim ticket'),
    )!;
    claimBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('.ticket-modal')!.textContent).toContain('Could not update the ticket.');
  });

  it('shows a retryable error state when loading fails', async () => {
    const m = mocks();
    m.service.list.mockReturnValueOnce(throwError(() => new Error('down'))).mockReturnValue(of(page()));
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Could not load support tickets.');
    el.querySelector<HTMLElement>('.list-error na-button button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('NT7K2P9Q');
  });
});
