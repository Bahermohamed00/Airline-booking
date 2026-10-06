import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminOffersPage } from './admin-offers.component';
import { OffersService, type AdminOffer } from '../../../core/services/offers.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/ui/toast.service';

function offer(partial: Partial<AdminOffer> = {}): AdminOffer {
  return {
    id: 'offer-1',
    title: 'Winter Sun Escapes',
    description: 'Warm-weather getaways from Frankfurt this winter.',
    badge: 'Winter sun',
    destination: 'Frankfurt → Dubai',
    offerValue: 'from €349',
    terms: null,
    imageUrl: null,
    validFrom: '2026-11-01',
    validUntil: '2027-02-28',
    status: 'ACTIVE',
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-01T10:00:00Z',
    ...partial,
  };
}

function mocks(list: AdminOffer[] = [offer()]) {
  return {
    offers: {
      listAdmin: vi.fn().mockReturnValue(of(list)),
      createAdmin: vi.fn().mockReturnValue(of(offer())),
      updateAdmin: vi.fn().mockReturnValue(of(offer())),
      deleteAdmin: vi.fn().mockReturnValue(of(offer({ status: 'INACTIVE' }))),
    },
    auth: { hasPermission: vi.fn().mockReturnValue(true) },
    toast: { success: vi.fn(), error: vi.fn() },
  };
}

type Mocks = ReturnType<typeof mocks>;

async function setup(m: Mocks): Promise<ComponentFixture<AdminOffersPage>> {
  await TestBed.configureTestingModule({
    imports: [AdminOffersPage],
    providers: [
      provideRouter([]),
      { provide: OffersService, useValue: m.offers },
      { provide: AuthService, useValue: m.auth },
      { provide: ToastService, useValue: m.toast },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(AdminOffersPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

function setField(el: HTMLElement, selector: string, value: string): void {
  const input = el.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    selector,
  )!;
  input.value = value;
  input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input'));
}

function submitDrawer(el: HTMLElement): void {
  el.querySelector<HTMLFormElement>('.drawer form')!.dispatchEvent(
    new Event('submit', { cancelable: true }),
  );
}

async function openCreateDrawer(fixture: ComponentFixture<AdminOffersPage>): Promise<HTMLElement> {
  const el = fixture.nativeElement as HTMLElement;
  el.querySelector<HTMLElement>('.page__head na-button button')!.click();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return el;
}

describe('AdminOffersPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('lists offers from the API with status, destination and validity', async () => {
    const m = mocks([offer(), offer({ id: 'offer-2', title: 'City Breaks', status: 'DRAFT' })]);
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(m.offers.listAdmin).toHaveBeenCalledWith(undefined);
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(el.textContent).toContain('Winter Sun Escapes');
    expect(el.textContent).toContain('Frankfurt → Dubai');
    expect(el.textContent).toContain('from €349');
    expect(el.textContent).toContain('ACTIVE');
    expect(el.textContent).toContain('DRAFT');
    expect(el.textContent).toContain('2026-11-01 → 2027-02-28');
  });

  it('gates the page behind offers:manage and never calls the API without it', async () => {
    const m = mocks();
    m.auth.hasPermission.mockReturnValue(false);
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(m.offers.listAdmin).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Access restricted');
    expect(el.querySelector('table')).toBeNull();
  });

  it('shows a retryable error state when loading fails', async () => {
    const m = mocks();
    m.offers.listAdmin
      .mockReturnValueOnce(throwError(() => new Error('down')))
      .mockReturnValue(of([offer()]));
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Could not load offers');

    el.querySelector<HTMLElement>('.list-error na-button button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.offers.listAdmin).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('Winter Sun Escapes');
  });

  it('shows an empty state when the catalog is empty', async () => {
    const fixture = await setup(mocks([]));
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No offers');
  });

  it('reloads through the API when the status filter changes', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    setField(el, '#status-filter', 'ACTIVE');
    await fixture.whenStable();

    expect(m.offers.listAdmin).toHaveBeenLastCalledWith('ACTIVE');
    expect(m.offers.listAdmin).toHaveBeenCalledTimes(2);
  });

  it('hides the delete action for already inactive offers', async () => {
    const fixture = await setup(mocks([offer({ status: 'INACTIVE' })]));
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.row-actions .btn--danger')).toBeNull();
    expect(el.querySelector('.row-actions .btn--secondary')).not.toBeNull();
  });

  it('creates an offer through the admin API and reloads the list', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openCreateDrawer(fixture);

    setField(el, '#of-title', 'Spring Sale');
    setField(el, '#of-desc', 'Shoulder-season fares across Europe.');
    setField(el, '#of-from', '2027-03-01');
    setField(el, '#of-until', '2027-05-31');
    fixture.detectChanges();
    submitDrawer(el);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.offers.createAdmin).toHaveBeenCalledWith({
      title: 'Spring Sale',
      description: 'Shoulder-season fares across Europe.',
      validFrom: '2027-03-01',
      validUntil: '2027-05-31',
      status: 'DRAFT',
    });
    expect(m.toast.success).toHaveBeenCalledWith('Offer created.');
    expect(m.offers.listAdmin).toHaveBeenCalledTimes(2);
    expect(el.querySelector('.drawer')).toBeNull();
  });

  it('edits an existing offer through the admin API', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLElement>('.row-actions na-button button')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector<HTMLInputElement>('#of-title')!.value).toBe('Winter Sun Escapes');
    expect(el.querySelector<HTMLInputElement>('#of-from')!.value).toBe('2026-11-01');

    setField(el, '#of-title', 'Winter Sun Escapes II');
    fixture.detectChanges();
    submitDrawer(el);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.offers.updateAdmin).toHaveBeenCalledWith(
      'offer-1',
      expect.objectContaining({
        title: 'Winter Sun Escapes II',
        badge: 'Winter sun',
        destination: 'Frankfurt → Dubai',
        status: 'ACTIVE',
        validFrom: '2026-11-01',
        validUntil: '2027-02-28',
      }),
    );
    expect(m.offers.createAdmin).not.toHaveBeenCalled();
    expect(m.toast.success).toHaveBeenCalledWith('Offer updated.');
  });

  it('blocks invalid submissions client-side without calling the API', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openCreateDrawer(fixture);

    submitDrawer(el);
    fixture.detectChanges();

    expect(m.offers.createAdmin).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Title is required');
    expect(el.textContent).toContain('Description is required');
  });

  it('blocks an inverted validity range without calling the API', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openCreateDrawer(fixture);

    setField(el, '#of-title', 'Backwards Sale');
    setField(el, '#of-desc', 'Valid range that runs backwards.');
    setField(el, '#of-from', '2027-05-31');
    setField(el, '#of-until', '2027-03-01');
    fixture.detectChanges();
    submitDrawer(el);
    fixture.detectChanges();

    expect(m.offers.createAdmin).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Valid from must be on or before valid until');
  });

  it('rejects an image URL that is neither assets/ nor https', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openCreateDrawer(fixture);

    setField(el, '#of-title', 'Bad Image Sale');
    setField(el, '#of-desc', 'Offer with a disallowed image URL.');
    setField(el, '#of-img', 'http://insecure.example.com/x.jpg');
    setField(el, '#of-from', '2027-03-01');
    setField(el, '#of-until', '2027-05-31');
    fixture.detectChanges();
    submitDrawer(el);
    fixture.detectChanges();

    expect(m.offers.createAdmin).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Use an assets/… path or an https:// URL.');
  });

  it('surfaces duplicate-title conflicts from the API as a toast', async () => {
    const m = mocks();
    m.offers.createAdmin.mockReturnValue(throwError(() => ({ status: 409 })));
    const fixture = await setup(m);
    const el = await openCreateDrawer(fixture);

    setField(el, '#of-title', 'Winter Sun Escapes');
    setField(el, '#of-desc', 'Duplicate of an existing offer.');
    setField(el, '#of-from', '2027-03-01');
    setField(el, '#of-until', '2027-05-31');
    fixture.detectChanges();
    submitDrawer(el);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.toast.error).toHaveBeenCalledWith('An offer with this title already exists.');
    expect(el.querySelector('.drawer')).not.toBeNull();
  });

  it('deactivates an offer through the API after confirmation', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLElement>('.row-actions .btn--danger')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('Delete offer?');

    el.querySelector<HTMLElement>('na-dialog .btn--danger')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.offers.deleteAdmin).toHaveBeenCalledWith('offer-1');
    expect(m.toast.success).toHaveBeenCalledWith('Offer deactivated.');
    expect(m.offers.listAdmin).toHaveBeenCalledTimes(2);
  });
});
