import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { SessionsPanel } from './sessions-panel.component';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/ui/toast.service';
import type { SessionInfo } from '../../../core/models/domain.model';

const SESSIONS: SessionInfo[] = [
  {
    id: 's-current',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    ipAddress: '203.0.113.10',
    createdAt: '2026-09-20T10:00:00Z',
    lastUsedAt: '2026-09-24T09:00:00Z',
    current: true,
  },
  {
    id: 's-mobile',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    ipAddress: '203.0.113.11',
    createdAt: '2026-09-18T10:00:00Z',
    lastUsedAt: '2026-09-23T09:00:00Z',
    current: false,
  },
];

interface Mocks {
  auth: {
    listSessions: ReturnType<typeof vi.fn>;
    revokeSession: ReturnType<typeof vi.fn>;
    logoutAll: ReturnType<typeof vi.fn>;
  };
  toast: Record<'success' | 'error' | 'info' | 'warning', ReturnType<typeof vi.fn>>;
}

async function setup(overrides: Partial<Mocks['auth']> = {}): Promise<Mocks> {
  const auth: Mocks['auth'] = {
    listSessions: vi.fn().mockReturnValue(of(SESSIONS)),
    revokeSession: vi.fn().mockReturnValue(of({ message: 'Session revoked' })),
    logoutAll: vi.fn().mockReturnValue(of({ message: 'Logged out of all sessions' })),
    ...overrides,
  };
  const toast: Mocks['toast'] = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };

  await TestBed.configureTestingModule({
    imports: [SessionsPanel],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: auth },
      { provide: ToastService, useValue: toast },
    ],
  }).compileComponents();

  return { auth, toast };
}

async function render() {
  const fixture = TestBed.createComponent(SessionsPanel);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

function confirmOpenDialog(el: HTMLElement): void {
  const confirm = el.querySelector<HTMLElement>('na-dialog .dialog__actions na-button:last-child button');
  expect(confirm, 'expected an open dialog with a confirm button').not.toBeNull();
  confirm!.click();
}

describe('SessionsPanel', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('lists sessions with friendly device labels and flags the current session', async () => {
    await setup();
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    const rows = el.querySelectorAll('.session-row');
    expect(rows).toHaveLength(2);
    expect(el.textContent).toContain('Chrome on Windows');
    expect(el.textContent).toContain('Safari on iOS');
    expect(el.textContent).toContain('Current session');
    // Only non-current sessions get a Revoke button
    expect(el.querySelectorAll('.session-row na-button')).toHaveLength(1);
  });

  it('never renders session ids or token-like values', async () => {
    await setup();
    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).not.toContain('s-current');
    expect(text).not.toContain('s-mobile');
    expect(text.toLowerCase()).not.toContain('tokenhash');
    expect(text.toLowerCase()).not.toContain('refreshtoken');
  });

  it('revokes a session after confirmation and reloads the list', async () => {
    const { auth, toast } = await setup();
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLElement>('.session-row na-button button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('na-dialog .dialog')).not.toBeNull();

    confirmOpenDialog(el);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(auth.revokeSession).toHaveBeenCalledWith('s-mobile');
    expect(auth.listSessions).toHaveBeenCalledTimes(2); // initial load + reload
    expect(toast.success).toHaveBeenCalled();
  });

  it('shows an error toast when revoke fails', async () => {
    const { auth, toast } = await setup({
      revokeSession: vi.fn().mockReturnValue(throwError(() => ({ status: 500, message: 'nope' }))),
    });
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLElement>('.session-row na-button button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    confirmOpenDialog(el);
    await fixture.whenStable();

    expect(toast.error).toHaveBeenCalled();
    expect(auth.listSessions).toHaveBeenCalledTimes(1); // no reload on failure
  });

  it('shows a loading skeleton until the sessions arrive', async () => {
    const pending = new Subject<SessionInfo[]>();
    await setup({ listSessions: vi.fn().mockReturnValue(pending.asObservable()) });
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('na-skeleton')).not.toBeNull();
    expect(el.querySelectorAll('.session-row')).toHaveLength(0);

    pending.next(SESSIONS);
    pending.complete();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelectorAll('.session-row')).toHaveLength(2);
  });

  it('renders an error state and retries on demand', async () => {
    const { auth } = await setup({
      listSessions: vi
        .fn()
        .mockReturnValueOnce(throwError(() => ({ status: 0, message: 'Network error' })))
        .mockReturnValue(of(SESSIONS)),
    });
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.alert--danger')).not.toBeNull();
    expect(el.querySelectorAll('.session-row')).toHaveLength(0);

    el.querySelector<HTMLElement>('.alert__retry')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(auth.listSessions).toHaveBeenCalledTimes(2);
    expect(el.querySelectorAll('.session-row')).toHaveLength(2);
  });

  it('renders an empty state when there are no sessions', async () => {
    await setup({ listSessions: vi.fn().mockReturnValue(of([])) });
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.textContent).toContain('No active sessions');
  });

  it('logs out everywhere after confirmation and navigates to login', async () => {
    const { auth, toast } = await setup();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;

    el.querySelector<HTMLElement>('.panel__foot na-button button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    confirmOpenDialog(el);
    await fixture.whenStable();

    expect(auth.logoutAll).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
