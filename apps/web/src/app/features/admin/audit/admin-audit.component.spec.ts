import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { AdminAuditPage } from './admin-audit.component';
import { AuditService, type AuditLogPage, type AuditLogItem } from './audit.service';

function item(partial: Partial<AuditLogItem>): AuditLogItem {
  return {
    id: 'id-1',
    event: 'PASSWORD_CHANGED',
    actorType: 'User',
    actorId: 'user-1',
    targetType: 'User',
    targetId: 'user-1',
    ipAddress: '203.0.113.5',
    createdAt: '2026-09-20T10:00:00Z',
    metadata: {},
    ...partial,
  };
}

function pageOf(items: AuditLogItem[], overrides: Partial<AuditLogPage> = {}): AuditLogPage {
  return { items, page: 1, limit: 20, total: items.length, totalPages: 1, ...overrides };
}

async function setup(listLogs: ReturnType<typeof vi.fn>) {
  await TestBed.configureTestingModule({
    imports: [AdminAuditPage],
    providers: [provideRouter([]), { provide: AuditService, useValue: { listLogs } }],
  }).compileComponents();

  const fixture = TestBed.createComponent(AdminAuditPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('AdminAuditPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('renders audit rows with event, actor, target and IP from the API', async () => {
    const listLogs = vi
      .fn()
      .mockReturnValue(
        of(
          pageOf([
            item({}),
            item({
              id: 'id-2',
              event: 'TOKEN_REUSE_DETECTED',
              actorType: 'Guest',
              ipAddress: null,
            }),
          ]),
        ),
      );
    const fixture = await setup(listLogs);
    const el = fixture.nativeElement as HTMLElement;

    expect(listLogs).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20 }));
    expect(el.textContent).toContain('PASSWORD_CHANGED');
    expect(el.textContent).toContain('TOKEN_REUSE_DETECTED');
    expect(el.textContent).toContain('203.0.113.5');
    expect(el.querySelectorAll('tbody tr.row').length).toBe(2);
  });

  it('shows a loading skeleton until data arrives', async () => {
    const pending = new Subject<AuditLogPage>();
    const listLogs = vi.fn().mockReturnValue(pending.asObservable());
    const fixture = await setup(listLogs);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('na-skeleton')).not.toBeNull();

    pending.next(pageOf([item({})]));
    pending.complete();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('na-skeleton')).toBeNull();
  });

  it('shows the empty state when no records match', async () => {
    const listLogs = vi.fn().mockReturnValue(of(pageOf([])));
    const fixture = await setup(listLogs);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('No audit records');
  });

  it('shows an error state and retries', async () => {
    const listLogs = vi
      .fn()
      .mockReturnValueOnce(throwError(() => ({ status: 500, message: 'x' })))
      .mockReturnValue(of(pageOf([item({})])));
    const fixture = await setup(listLogs);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.alert--danger')).not.toBeNull();
    el.querySelector<HTMLElement>('.alert__retry')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(listLogs).toHaveBeenCalledTimes(2);
    expect(el.textContent).toContain('PASSWORD_CHANGED');
  });

  it('applies filters through the API (not client-side filtering)', async () => {
    const listLogs = vi.fn().mockReturnValue(of(pageOf([item({})])));
    const fixture = await setup(listLogs);
    const el = fixture.nativeElement as HTMLElement;

    const set = (id: string, value: string) => {
      const input = el.querySelector<HTMLInputElement | HTMLSelectElement>(id)!;
      input.value = value;
      input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input'));
    };
    set('#f-event', 'PASSWORD_CHANGED');
    set('#f-actor-type', 'User');
    set('#f-target', 'user-1');
    set('#f-search', '203.0.113');
    fixture.detectChanges();
    el.querySelector<HTMLFormElement>('form')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await fixture.whenStable();

    expect(listLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 1,
        event: 'PASSWORD_CHANGED',
        actorType: 'User',
        targetId: 'user-1',
        search: '203.0.113',
      }),
    );
  });

  it('paginates with next/previous through the API', async () => {
    const listLogs = vi.fn().mockReturnValue(of(pageOf([item({})], { total: 45, totalPages: 3 })));
    const fixture = await setup(listLogs);
    const el = fixture.nativeElement as HTMLElement;

    const next = [...el.querySelectorAll<HTMLElement>('.pagination na-button button')].find((b) =>
      b.textContent?.includes('Next'),
    )!;
    next.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(listLogs).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    expect(el.textContent).toContain('Page 2 of 3');
    expect(el.textContent).toContain('45 records');

    const prev = [...el.querySelectorAll<HTMLElement>('.pagination na-button button')].find((b) =>
      b.textContent?.includes('Previous'),
    )!;
    prev.click();
    await fixture.whenStable();
    expect(listLogs).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
  });

  it('expands a row to show sanitized metadata and never renders sensitive keys', async () => {
    const listLogs = vi
      .fn()
      .mockReturnValue(of(pageOf([item({ metadata: { reason: 'invalid_or_expired' } })])));
    const fixture = await setup(listLogs);
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLElement>('tbody tr.row')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('invalid_or_expired');
    expect(el.textContent).not.toContain('passwordHash');
    expect(el.textContent).not.toContain('refreshToken');
  });
});
