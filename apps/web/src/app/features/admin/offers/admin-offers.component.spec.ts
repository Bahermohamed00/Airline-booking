import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminOffersPage } from './admin-offers.component';
import { OffersService, type AdminOffer } from '../../../core/services/offers.service';
import { CatalogService } from '../catalog/catalog.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/ui/toast.service';
import type { Route } from '../../../core/models/domain.model';

const ROUTES: Route[] = [
  {
    id: 'route-1',
    originAirportId: 'a-fra',
    destinationAirportId: 'a-dxb',
    origin: { iataCode: 'FRA' },
    destination: { iataCode: 'DXB' },
    status: 'ACTIVE',
  } as unknown as Route,
  {
    id: 'route-2',
    originAirportId: 'a-fra',
    destinationAirportId: 'a-jfk',
    origin: { iataCode: 'FRA' },
    destination: { iataCode: 'JFK' },
    status: 'ACTIVE',
  } as unknown as Route,
];

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
    bookable: false,
    discount: null,
    eligibility: null,
    status: 'ACTIVE',
    lifecycleStatus: 'ACTIVE',
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
      deletePermanentAdmin: vi.fn().mockReturnValue(of(offer())),
    },
    catalog: { listRoutes: vi.fn().mockReturnValue(of(ROUTES)) },
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
      { provide: CatalogService, useValue: m.catalog },
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

async function openEditDrawer(
  fixture: ComponentFixture<AdminOffersPage>,
  rowIndex = 0,
): Promise<HTMLElement> {
  const el = fixture.nativeElement as HTMLElement;
  const row = el.querySelectorAll('tbody tr')[rowIndex] as HTMLElement;
  Array.from(row.querySelectorAll<HTMLButtonElement>('na-button button')).find((b) =>
    b.textContent?.includes('Edit'),
  )!.click();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return el;
}

/** Picks the offer type; only bookable reveals the discount/eligibility block. */
async function setMode(
  fixture: ComponentFixture<AdminOffersPage>,
  value: 'bookable' | 'marketing',
): Promise<HTMLElement> {
  const el = fixture.nativeElement as HTMLElement;
  el.querySelector<HTMLInputElement>(`#of-mode-${value}`)!.click();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return el;
}

/** Clicks a dialog action button by its visible label. */
function clickDialog(el: HTMLElement, label: string): void {
  const btn = Array.from(el.querySelectorAll<HTMLButtonElement>('na-dialog na-button button')).find(
    (b) => b.textContent?.trim() === label,
  )!;
  btn.click();
}

/**
 * `open` is a signal input, not a DOM attribute, so an open dialog is detected
 * by the rendered panel rather than by `na-dialog[open]`.
 */
function openDialogs(el: HTMLElement): HTMLElement[] {
  return Array.from(el.querySelectorAll<HTMLElement>('na-dialog .dialog'));
}

const CONFIRM_TERMS = 'Clear terms';
const CANCEL = 'Cancel';

/** A bookable offer exactly as GET /admin/offers returns it today. */
function bookableOffer(over: Partial<AdminOffer> = {}): AdminOffer {
  return offer({
    id: 'offer-bookable',
    title: 'NovaAir Business Saver',
    bookable: true,
    discountType: 'PERCENT',
    discountValue: 15,
    routeId: 'route-1',
    cabinClass: 'BUSINESS',
    discount: { type: 'PERCENT', value: 15 },
    eligibility: {
      routeId: 'route-1',
      originIata: 'FRA',
      destinationIata: 'DXB',
      cabinClass: 'BUSINESS',
    },
    ...over,
  });
}

describe('AdminOffersPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('lists offers from the API with status, destination and validity', async () => {
    const m = mocks([
      offer(),
      offer({ id: 'offer-2', title: 'City Breaks', status: 'DRAFT', lifecycleStatus: 'DRAFT' }),
    ]);
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(m.offers.listAdmin).toHaveBeenCalledWith(undefined);
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(el.textContent).toContain('Winter Sun Escapes');
    expect(el.textContent).toContain('Frankfurt → Dubai');
    expect(el.textContent).toContain('from €349');
    expect(el.textContent).toContain('Active');
    expect(el.textContent).toContain('Draft');
    expect(el.textContent).toContain('2026-11-01 → 2027-02-28');
  });

  it('keeps an expired offer in the list and labels it Expired while showing the stored status', async () => {
    const m = mocks([
      offer(),
      offer({
        id: 'offer-expired',
        title: 'Autumn Flash Sale',
        status: 'ACTIVE', // still stored as ACTIVE…
        lifecycleStatus: 'EXPIRED', // …but the validity window has closed
        validUntil: '2026-06-30',
      }),
    ]);
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2); // not hidden
    const row = rows[1] as HTMLElement;
    expect(row.textContent).toContain('Autumn Flash Sale');
    expect(row.textContent).toContain('Expired');
    // The raw stored status stays visible next to the derived lifecycle.
    expect(row.querySelector('.status-note')?.textContent).toContain('stored: ACTIVE');
    expect(row.textContent).toContain('2026-11-01 → 2026-06-30');
  });

  it('labels every derived lifecycle state without rewriting the stored status', async () => {
    const m = mocks([
      offer({ id: 'a', title: 'Live', status: 'ACTIVE', lifecycleStatus: 'ACTIVE' }),
      offer({ id: 'b', title: 'Upcoming', status: 'ACTIVE', lifecycleStatus: 'SCHEDULED' }),
      offer({ id: 'c', title: 'Expired', status: 'ACTIVE', lifecycleStatus: 'EXPIRED' }),
      offer({ id: 'd', title: 'Drafted', status: 'DRAFT', lifecycleStatus: 'DRAFT' }),
      offer({ id: 'e', title: 'Switched off', status: 'INACTIVE', lifecycleStatus: 'INACTIVE' }),
      offer({ id: 'f', title: 'Ended', status: 'EXPIRED', lifecycleStatus: 'EXPIRED' }),
    ]);
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    const statuses = Array.from(el.querySelectorAll('tbody tr')).map((r) =>
      (r.querySelector('td[data-label="Status"]') as HTMLElement).textContent?.trim(),
    );
    expect(statuses[0]).toContain('Active');
    expect(statuses[1]).toContain('Scheduled');
    expect(statuses[2]).toContain('Expired');
    expect(statuses[3]).toContain('Draft');
    expect(statuses[4]).toContain('Inactive');
    expect(statuses[5]).toContain('Expired');

    // Only rows whose derived status differs from the stored one carry a note.
    const notes = Array.from(el.querySelectorAll('.status-note')).map((n) => n.textContent?.trim());
    expect(notes).toEqual(['stored: ACTIVE', 'stored: ACTIVE']);
  });

  it('shows bookability separately from lifecycle and never calls expired terms bookable', async () => {
    const m = mocks([
      offer({ id: 'a', title: 'Live bookable', status: 'ACTIVE', lifecycleStatus: 'ACTIVE', bookable: true }),
      offer({
        id: 'b',
        title: 'Expired with terms',
        status: 'ACTIVE',
        lifecycleStatus: 'EXPIRED',
        bookable: true, // historical discount terms still on the row
      }),
      offer({ id: 'c', title: 'Upcoming with terms', status: 'ACTIVE', lifecycleStatus: 'SCHEDULED', bookable: true }),
      offer({ id: 'd', title: 'Marketing', status: 'ACTIVE', lifecycleStatus: 'ACTIVE', bookable: false }),
    ]);
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    const cell = (i: number) =>
      (el.querySelectorAll('tbody tr')[i].querySelector('td[data-label="Bookability"]') as HTMLElement)
        .textContent ?? '';

    expect(cell(0)).toContain('Bookable');
    expect(cell(0)).not.toContain('not bookable');

    // Expired + terms: explicitly not a live booking promise, with the reason.
    expect(cell(1)).toContain('Terms set — not bookable');
    expect(cell(1)).toContain('Validity period has ended');

    expect(cell(2)).toContain('Terms set — not bookable');
    expect(cell(2)).toContain('Valid from a future date');

    expect(cell(3)).toContain('Marketing-only');
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

  it('hides the deactivate action for already inactive offers', async () => {
    const fixture = await setup(mocks([offer({ status: 'INACTIVE' })]));
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.row-actions .btn--danger')).toBeNull();
    expect(el.querySelector('.row-actions .btn--secondary')).not.toBeNull();
    // Permanent deletion stays available for cleanup of unused inactive offers.
    expect(el.querySelector('.row-actions .permanent-delete')).not.toBeNull();
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

    expect(el.textContent).toContain('Deactivate offer?');
    expect(el.textContent).toContain('no longer be available to customers');
    expect(el.textContent).toContain('historical records remain');

    el.querySelector<HTMLElement>('na-dialog .btn--danger')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.offers.deleteAdmin).toHaveBeenCalledWith('offer-1');
    expect(m.toast.success).toHaveBeenCalledWith('Offer deactivated.');
    expect(m.offers.listAdmin).toHaveBeenCalledTimes(2);
  });

  it('shows the discount value input only when a discount type is selected', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openCreateDrawer(fixture).then(async () => setMode(fixture, 'bookable'));

    expect(el.querySelector('#of-discount-value')).toBeNull();

    setField(el, '#of-discount-type', 'PERCENT');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('#of-discount-value')).not.toBeNull();

    setField(el, '#of-discount-type', '');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('#of-discount-value')).toBeNull();
  });

  it('hides the terms block entirely for a marketing-only offer', async () => {
    const m = mocks();
    const fixture = await setup(m);
    await openCreateDrawer(fixture);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('#of-discount-type')).toBeNull();
    expect(el.querySelector('#of-route')).toBeNull();
    expect(el.querySelector('#of-cabin')).toBeNull();
    expect(el.textContent).toContain('cannot be booked');
  });

  it('offers real routes and cabin classes in the eligibility selects', async () => {
    const m = mocks();
    const fixture = await setup(m);
    await openCreateDrawer(fixture);
    const el = await setMode(fixture, 'bookable');

    const routeOptions = Array.from(
      el.querySelectorAll<HTMLOptionElement>('#of-route option'),
    ).map((o) => o.textContent?.trim());
    expect(routeOptions[0]).toBe('All routes');
    expect(routeOptions).toContain('FRA → DXB');
    expect(routeOptions).toContain('FRA → JFK');

    const cabinOptions = Array.from(
      el.querySelectorAll<HTMLOptionElement>('#of-cabin option'),
    ).map((o) => o.textContent?.trim());
    expect(cabinOptions).toEqual(['All cabins', 'Economy', 'Premium Economy', 'Business', 'First']);
  });

  it('submits bookable terms only when a discount type is chosen', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openCreateDrawer(fixture).then(async () => setMode(fixture, 'bookable'));

    setField(el, '#of-title', 'Miles & More Monday');
    setField(el, '#of-desc', 'Ten percent off every Monday departure.');
    setField(el, '#of-from', '2027-03-01');
    setField(el, '#of-until', '2027-05-31');
    setField(el, '#of-discount-type', 'PERCENT');
    fixture.detectChanges();
    setField(el, '#of-discount-value', '10');
    setField(el, '#of-route', 'route-1');
    setField(el, '#of-cabin', 'BUSINESS');
    fixture.detectChanges();
    submitDrawer(el);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.offers.createAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        discountType: 'PERCENT',
        discountValue: 10,
        routeId: 'route-1',
        cabinClass: 'BUSINESS',
      }),
    );
  });

  it('blocks an out-of-range percentage client-side without calling the API', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = await openCreateDrawer(fixture).then(async () => setMode(fixture, 'bookable'));

    setField(el, '#of-title', 'Too Generous Sale');
    setField(el, '#of-desc', 'A percentage above the allowed maximum.');
    setField(el, '#of-from', '2027-03-01');
    setField(el, '#of-until', '2027-05-31');
    setField(el, '#of-discount-type', 'PERCENT');
    fixture.detectChanges();
    setField(el, '#of-discount-value', '150');
    fixture.detectChanges();
    submitDrawer(el);
    fixture.detectChanges();

    expect(m.offers.createAdmin).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Percentage must be greater than 0 and at most 100');
  });

  it('populates the drawer from the bookable terms of the edited offer', async () => {
    const m = mocks([bookableOffer({ discount: { type: 'FIXED_AMOUNT', value: 50 }, eligibility: { routeId: 'route-1', originIata: 'FRA', destinationIata: 'DXB', cabinClass: 'ECONOMY' } })]);
    const fixture = await setup(m);
    const el = await openEditDrawer(fixture);

    // Mode follows the backend invariant: a valid discount pair ⇒ Bookable.
    expect(el.querySelector<HTMLInputElement>('#of-mode-bookable')!.checked).toBe(true);
    expect(el.querySelector<HTMLInputElement>('#of-mode-marketing')!.checked).toBe(false);
    expect(el.querySelector<HTMLSelectElement>('#of-discount-type')!.value).toBe('FIXED_AMOUNT');
    expect(el.querySelector<HTMLInputElement>('#of-discount-value')!.value).toBe('50');
    expect(el.querySelector<HTMLSelectElement>('#of-route')!.value).toBe('route-1');
    expect(el.querySelector<HTMLSelectElement>('#of-cabin')!.value).toBe('ECONOMY');
  });

  it('selects Marketing-only for an offer with no discount terms', async () => {
    const m = mocks(); // default offer() is marketing-only: discount/eligibility null
    const fixture = await setup(m);
    const el = await openEditDrawer(fixture);

    expect(el.querySelector<HTMLInputElement>('#of-mode-marketing')!.checked).toBe(true);
    expect(el.querySelector<HTMLInputElement>('#of-mode-bookable')!.checked).toBe(false);
    expect(el.querySelector('#of-discount-type')).toBeNull();
  });

  it('saving an unchanged bookable offer preserves its terms', async () => {
    const m = mocks([bookableOffer()]);
    const fixture = await setup(m);
    const el = await openEditDrawer(fixture);

    submitDrawer(el);
    await fixture.whenStable();
    fixture.detectChanges();

    const payload = m.offers.updateAdmin.mock.calls[0][1] as Record<string, unknown>;
    expect(payload['discountType']).toBe('PERCENT');
    expect(payload['discountValue']).toBe(15);
    expect(payload['routeId']).toBe('route-1');
    expect(payload['cabinClass']).toBe('BUSINESS');
    expect(m.toast.success).toHaveBeenCalledWith('Offer updated.');
  });

  it('clearing a previously set route and cabin scope sends explicit nulls', async () => {
    const m = mocks([bookableOffer()]);
    const fixture = await setup(m);
    const el = await openEditDrawer(fixture);

    setField(el, '#of-route', '');
    setField(el, '#of-cabin', '');
    fixture.detectChanges();
    submitDrawer(el);
    await fixture.whenStable();
    fixture.detectChanges();

    const payload = m.offers.updateAdmin.mock.calls[0][1] as Record<string, unknown>;
    expect(payload['routeId']).toBeNull();
    expect(payload['cabinClass']).toBeNull();
    // Discount untouched → still sent, so nothing is lost.
    expect(payload['discountType']).toBe('PERCENT');
    expect(payload['discountValue']).toBe(15);
  });

  it('switching to Marketing-only asks for confirmation before discarding terms', async () => {
    const m = mocks([bookableOffer()]);
    const fixture = await setup(m);
    let el = await openEditDrawer(fixture);

    el = await setMode(fixture, 'marketing');

    const dialog = openDialogs(el)[0];
    expect(dialog).toBeDefined();
    expect(dialog.textContent).toContain('15%');
    expect(dialog.textContent).toContain('no longer be bookable');
    // Nothing is sent until the switch is confirmed.
    submitDrawer(el);
    expect(m.offers.updateAdmin).not.toHaveBeenCalled();
  });

  it('cancelling the confirmation keeps Marketing-only selected and all form values', async () => {
    const m = mocks([bookableOffer()]);
    const fixture = await setup(m);
    let el = await openEditDrawer(fixture);
    setField(el, '#of-title', 'Edited title');

    el = await setMode(fixture, 'marketing');
    clickDialog(el, CANCEL);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(openDialogs(el)).toHaveLength(0);
    // Cancel restores Bookable (the mode before the attempted switch)…
    expect(el.querySelector<HTMLInputElement>('#of-mode-bookable')!.checked).toBe(true);
    // …and no form value was touched.
    expect(el.querySelector<HTMLSelectElement>('#of-discount-type')!.value).toBe('PERCENT');
    expect(el.querySelector<HTMLInputElement>('#of-discount-value')!.value).toBe('15');
    expect(el.querySelector<HTMLSelectElement>('#of-route')!.value).toBe('route-1');
    expect(el.querySelector<HTMLInputElement>('#of-title')!.value).toBe('Edited title');
    expect(m.offers.updateAdmin).not.toHaveBeenCalled();
  });

  it('confirming the switch clears discount and eligibility with explicit nulls', async () => {
    const m = mocks([bookableOffer()]);
    const fixture = await setup(m);
    let el = await openEditDrawer(fixture);

    el = await setMode(fixture, 'marketing');
    clickDialog(el, CONFIRM_TERMS);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector<HTMLInputElement>('#of-mode-marketing')!.checked).toBe(true);
    submitDrawer(el);
    await fixture.whenStable();
    fixture.detectChanges();

    const payload = m.offers.updateAdmin.mock.calls[0][1] as Record<string, unknown>;
    expect(payload['discountType']).toBeNull();
    expect(payload['discountValue']).toBeNull();
    expect(payload['routeId']).toBeNull();
    expect(payload['cabinClass']).toBeNull();
    expect(m.toast.success).toHaveBeenCalledWith('Offer updated.');
  });

  it('switching to Bookable requires valid explicit discount terms before saving', async () => {
    const m = mocks(); // marketing-only offer, no terms
    const fixture = await setup(m);
    let el = await openCreateDrawer(fixture);

    el = await setMode(fixture, 'bookable');
    setField(el, '#of-title', 'New Bookable Offer');
    setField(el, '#of-desc', 'Twelve percent off the Economy base fare.');
    setField(el, '#of-from', '2027-03-01');
    setField(el, '#of-until', '2027-05-31');
    fixture.detectChanges();

    // Bookable with no discount type yet → blocked, nothing sent.
    submitDrawer(el);
    fixture.detectChanges();
    expect(m.offers.createAdmin).not.toHaveBeenCalled();

    // Out-of-range value is still rejected by the existing rule.
    setField(el, '#of-discount-type', 'PERCENT');
    fixture.detectChanges();
    setField(el, '#of-discount-value', '150');
    fixture.detectChanges();
    submitDrawer(el);
    fixture.detectChanges();
    expect(m.offers.createAdmin).not.toHaveBeenCalled();
    expect(el.textContent).toContain('Percentage must be greater than 0 and at most 100');

    // Valid terms go through with explicit values.
    setField(el, '#of-discount-value', '12');
    fixture.detectChanges();
    submitDrawer(el);
    await fixture.whenStable();
    expect(m.offers.createAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        discountType: 'PERCENT',
        discountValue: 12,
        routeId: null,
        cabinClass: null,
      }),
    );
  });

  it('a marketing-only offer staying Marketing-only omits the bookable fields entirely', async () => {
    const m = mocks(); // default offer() is marketing-only
    const fixture = await setup(m);
    const el = await openEditDrawer(fixture);

    submitDrawer(el);
    await fixture.whenStable();
    fixture.detectChanges();

    const payload = m.offers.updateAdmin.mock.calls[0][1] as Record<string, unknown>;
    for (const key of ['discountType', 'discountValue', 'routeId', 'cabinClass']) {
      expect(payload).not.toHaveProperty(key);
    }
  });

  it('reopening after a save reflects the returned admin response', async () => {
    const m = mocks([bookableOffer()]);
    m.offers.updateAdmin.mockReturnValue(of(bookableOffer({ title: 'Renamed Offer' })));
    m.offers.listAdmin.mockReturnValue(
      of([bookableOffer({ title: 'Renamed Offer' })]),
    );
    const fixture = await setup(m);
    let el = await openEditDrawer(fixture);

    setField(el, '#of-title', 'Renamed Offer');
    fixture.detectChanges();
    submitDrawer(el);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('tbody')!.textContent).toContain('Renamed Offer');

    // Reopening loads the saved state, including the real terms.
    el = await openEditDrawer(fixture);
    expect(el.querySelector<HTMLInputElement>('#of-title')!.value).toBe('Renamed Offer');
    expect(el.querySelector<HTMLInputElement>('#of-mode-bookable')!.checked).toBe(true);
    expect(el.querySelector<HTMLSelectElement>('#of-discount-type')!.value).toBe('PERCENT');
    expect(el.querySelector<HTMLInputElement>('#of-discount-value')!.value).toBe('15');
    expect(el.querySelector<HTMLSelectElement>('#of-route')!.value).toBe('route-1');
  });

  it('permanently deletes an offer after the distinct confirmation dialog', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLElement>('.row-actions .permanent-delete button')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('Delete offer permanently?');
    expect(el.textContent).toContain('only possible if no booking references it');
    expect(el.textContent).not.toContain('Deactivate offer?');

    el.querySelector<HTMLElement>('na-dialog .btn--danger')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.offers.deletePermanentAdmin).toHaveBeenCalledWith('offer-1');
    expect(m.offers.deleteAdmin).not.toHaveBeenCalled();
    expect(m.toast.success).toHaveBeenCalledWith('Offer permanently deleted.');
    expect(m.offers.listAdmin).toHaveBeenCalledTimes(2);
  });

  it('explains OFFER_IN_USE on permanent delete and suggests deactivation instead', async () => {
    const m = mocks();
    m.offers.deletePermanentAdmin.mockReturnValue(
      throwError(() => ({ status: 409, error: { code: 'OFFER_IN_USE', bookingCount: 3 } })),
    );
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLElement>('.row-actions .permanent-delete button')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    el.querySelector<HTMLElement>('na-dialog .btn--danger')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(m.toast.error).toHaveBeenCalledWith(
      'This offer cannot be permanently deleted because it is referenced by 3 existing bookings. You can deactivate it instead.',
    );
    expect(m.toast.success).not.toHaveBeenCalled();
  });
});
