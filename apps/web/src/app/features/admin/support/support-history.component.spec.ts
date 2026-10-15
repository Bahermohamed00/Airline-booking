import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminSupportHistoryPage } from './support-history.component';
import {
  AdminSupportService,
  type AdminTicket,
  type AdminTicketPage,
  type Conversation,
  type SupportMessage,
} from './admin-support.service';
import { ToastService } from '../../../shared/ui/toast.service';

const CUSTOMER = { id: 'u-1', firstName: 'Lena', lastName: 'Hoffmann', email: 'lena@example.com' };
const AGENT = { id: 'ag-1', firstName: 'Ada', lastName: 'Agent', email: 'ada@novaair.dev' };

function ticket(partial: Partial<AdminTicket> = {}): AdminTicket {
  return {
    id: 't-1',
    ticketNumber: 'NT7K2P9Q',
    subject: 'Cannot log in',
    description: 'My password stopped working today.',
    status: 'CLOSED',
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-05T10:00:00Z',
    resolvedAt: '2026-10-05T09:00:00Z',
    closedAt: '2026-10-05T10:00:00Z',
    customer: CUSTOMER,
    assignee: AGENT,
    lastMessageAt: '2026-10-05T10:00:00Z',
    unreadCount: 0,
    ...partial,
  };
}

const OPENING_MESSAGE: SupportMessage = {
  id: 'm-1',
  body: 'My password stopped working today.',
  senderType: 'CUSTOMER',
  deliveryStatus: 'NONE',
  createdAt: '2026-10-01T08:00:00Z',
  sender: { id: 'u-1', firstName: 'Lena', lastName: 'Hoffmann' },
};

function page(partial: Partial<AdminTicketPage> = {}): AdminTicketPage {
  return { items: [ticket()], page: 1, limit: 20, total: 1, totalPages: 1, ...partial };
}

function mocks(result: AdminTicketPage = page()) {
  return {
    service: {
      list: vi.fn().mockReturnValue(of(result)),
      conversation: vi.fn().mockReturnValue(of({ ticket: ticket(), messages: [OPENING_MESSAGE] } as Conversation)),
    },
    toast: { success: vi.fn(), error: vi.fn() },
  };
}

type Mocks = ReturnType<typeof mocks>;

async function setup(m: Mocks): Promise<ComponentFixture<AdminSupportHistoryPage>> {
  await TestBed.configureTestingModule({
    imports: [AdminSupportHistoryPage],
    providers: [
      provideRouter([]),
      { provide: AdminSupportService, useValue: m.service },
      { provide: ToastService, useValue: m.toast },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(AdminSupportHistoryPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

async function openDetail(fixture: ComponentFixture<AdminSupportHistoryPage>): Promise<HTMLElement> {
  const el = fixture.nativeElement as HTMLElement;
  el.querySelector<HTMLElement>('na-data-table tbody tr')!.click();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return el;
}

describe('AdminSupportHistoryPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads closed tickets only, with customer, email, subject, closed date, activity and assignee', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(m.service.list).toHaveBeenCalledWith({
      status: 'CLOSED',
      search: undefined,
      closedFrom: undefined,
      closedTo: undefined,
      page: 1,
      limit: 20,
    });
    expect(el.textContent).toContain('NT7K2P9Q');
    expect(el.textContent).toContain('Lena Hoffmann');
    expect(el.textContent).toContain('lena@example.com');
    expect(el.textContent).toContain('Cannot log in');
    expect(el.textContent).toContain('Ada Agent');
  });

  it('sends combined search + date range filters to the API', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;
    m.service.list.mockClear();

    const search = el.querySelector<HTMLInputElement>('#hist-search')!;
    search.value = 'lena@example.com';
    search.dispatchEvent(new Event('input'));
    const from = el.querySelector<HTMLInputElement>('#hist-from')!;
    from.value = '2026-10-01';
    from.dispatchEvent(new Event('input'));
    const to = el.querySelector<HTMLInputElement>('#hist-to')!;
    to.value = '2026-10-07';
    to.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(m.service.list).toHaveBeenLastCalledWith({
      status: 'CLOSED',
      search: 'lena@example.com',
      closedFrom: '2026-10-01',
      closedTo: '2026-10-07',
      page: 1,
      limit: 20,
    });
  });

  it('clear filters resets search and dates and reloads the unfiltered history', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    const search = el.querySelector<HTMLInputElement>('#hist-search')!;
    search.value = 'password';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();

    el.querySelector<HTMLElement>('.filters__clear na-button button')!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(m.service.list).toHaveBeenLastCalledWith({
      status: 'CLOSED',
      search: undefined,
      closedFrom: undefined,
      closedTo: undefined,
      page: 1,
      limit: 20,
    });
    expect((el.querySelector('#hist-search') as HTMLInputElement).value).toBe('');
  });

  it('paginates server-side', async () => {
    const m = mocks(page({ total: 45, totalPages: 3 }));
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;
    m.service.list.mockClear();

    const buttons = [...el.querySelectorAll<HTMLElement>('.pagination na-button button')];
    buttons.find((b) => b.textContent!.includes('Next'))!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(m.service.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
  });

  it('opens the closed conversation read-only — full history, no composer, no lifecycle actions', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openDetail(fixture);

    const modal = el.querySelector('.ticket-modal')!;
    expect(modal.textContent).toContain('Closed');
    expect(modal.textContent).toContain('lena@example.com');
    expect(modal.textContent).toContain('Ada Agent');
    expect(modal.textContent).toContain('My password stopped working today.');
    expect(modal.querySelector('.message--incoming')).not.toBeNull();

    expect(modal.querySelector('.composer')).toBeNull();
    expect(modal.querySelector('.ticket-actions')).toBeNull();
  });

  it('shows a retryable error state when loading fails', async () => {
    const m = mocks();
    m.service.list.mockReturnValueOnce(throwError(() => new Error('down'))).mockReturnValue(of(page()));
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Could not load support history.');
    el.querySelector<HTMLElement>('.list-error na-button button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('NT7K2P9Q');
  });
});
