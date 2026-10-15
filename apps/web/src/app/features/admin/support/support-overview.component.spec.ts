import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminSupportOverviewPage } from './support-overview.component';
import { AdminSupportService, type SupportOverview } from './admin-support.service';

const STATS: SupportOverview = { total: 7, open: 3, unreadMessages: 4, inProgress: 2, resolved: 1, closed: 1 };

function mocks() {
  return { service: { overview: vi.fn().mockReturnValue(of(STATS)) } };
}

type Mocks = ReturnType<typeof mocks>;

async function setup(m: Mocks): Promise<ComponentFixture<AdminSupportOverviewPage>> {
  await TestBed.configureTestingModule({
    imports: [AdminSupportOverviewPage],
    providers: [provideRouter([]), { provide: AdminSupportService, useValue: m.service }],
  }).compileComponents();

  const fixture = TestBed.createComponent(AdminSupportOverviewPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('AdminSupportOverviewPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads and renders the six support-only stat cards', async () => {
    const m = mocks();
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(m.service.overview).toHaveBeenCalledTimes(1);
    const text = el.textContent!;
    expect(text).toContain('Total tickets');
    expect(text).toContain('Open tickets');
    expect(text).toContain('Unread messages');
    expect(text).toContain('In progress');
    expect(text).toContain('Resolved');
    expect(text).toContain('Closed');
    expect(text).toContain('7');
    expect(text).toContain('4');

    // No general admin statistics leak into the support overview.
    expect(text).not.toContain('Revenue');
    expect(text).not.toContain('Payments');
    expect(text).not.toContain('Users');
    expect(text).not.toContain('Flights');
  });

  it('shows a retryable error state when loading fails', async () => {
    const m = mocks();
    m.service.overview.mockReturnValueOnce(throwError(() => new Error('down'))).mockReturnValue(of(STATS));
    const fixture = await setup(m);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('Could not load the support overview.');
    el.querySelector<HTMLElement>('.list-error na-button button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('Total tickets');
  });
});
