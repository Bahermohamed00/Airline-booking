import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CustomerSupportPage } from './support.component';
import { CustomerSupportService, type SupportTicket } from './support.service';

const TICKET: SupportTicket = {
  id: 't-1',
  ticketNumber: 'NT7K2P9Q',
  subject: 'Cannot log in',
  status: 'OPEN',
  createdAt: '2026-10-07T08:00:00Z',
  resolvedAt: null,
  closedAt: null,
};

function mocks() {
  return { support: { createTicket: vi.fn().mockReturnValue(of(TICKET)) } };
}

type Mocks = ReturnType<typeof mocks>;

async function setup(m: Mocks): Promise<ComponentFixture<CustomerSupportPage>> {
  await TestBed.configureTestingModule({
    imports: [CustomerSupportPage],
    providers: [provideRouter([]), { provide: CustomerSupportService, useValue: m.support }],
  }).compileComponents();

  const fixture = TestBed.createComponent(CustomerSupportPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

function setField(el: HTMLElement, selector: string, value: string): void {
  const input = el.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('CustomerSupportPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('submits a valid complaint and shows the success state with the ticket number', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    setField(el, '#ticket-subject', 'Cannot log in');
    setField(el, '#ticket-description', 'My password stopped working today.');
    fixture.detectChanges();
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.support.createTicket).toHaveBeenCalledWith({
      subject: 'Cannot log in',
      description: 'My password stopped working today.',
    });
    expect(el.textContent).toContain('Request received');
    expect(el.textContent).toContain('NT7K2P9Q');
    expect(el.textContent).toContain('Open');
  });

  it('validates subject and description without calling the API', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    setField(el, '#ticket-subject', 'Ab');
    setField(el, '#ticket-description', 'My password stopped working today.');
    fixture.detectChanges();
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    expect(m.support.createTicket).not.toHaveBeenCalled();
    expect(el.textContent).toContain('at least 3 characters');

    setField(el, '#ticket-subject', 'Valid subject');
    setField(el, '#ticket-description', 'short');
    fixture.detectChanges();
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();

    expect(m.support.createTicket).not.toHaveBeenCalled();
    expect(el.textContent).toContain('at least 10 characters');
  });

  it('shows API errors and recovers to the form', async () => {
    const m = mocks();
    m.support.createTicket.mockReturnValue(throwError(() => ({ status: 500 })));
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    setField(el, '#ticket-subject', 'Cannot log in');
    setField(el, '#ticket-description', 'My password stopped working today.');
    fixture.detectChanges();
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('Could not submit your request.');
    expect(el.querySelector('form')).not.toBeNull(); // still on the form
  });

  it('reset returns to an empty form after a successful submission', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    setField(el, '#ticket-subject', 'Cannot log in');
    setField(el, '#ticket-description', 'My password stopped working today.');
    fixture.detectChanges();
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();

    const buttons = [...el.querySelectorAll<HTMLElement>('na-button button')];
    buttons.find((b) => b.textContent!.includes('Submit another'))!.click();
    fixture.detectChanges();

    expect(el.querySelector('.support__success')).toBeNull();
    expect((el.querySelector('#ticket-subject') as HTMLInputElement).value).toBe('');
  });
});
