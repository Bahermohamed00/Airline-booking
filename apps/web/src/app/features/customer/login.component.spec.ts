import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { LoginPage } from './login.component';
import { AuthService } from '../../core/services/auth.service';

async function setup(reason: string | null) {
  await TestBed.configureTestingModule({
    imports: [LoginPage],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: convertToParamMap(reason ? { reason } : {}) } },
      },
      { provide: AuthService, useValue: { login: vi.fn(), setSession: vi.fn() } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(LoginPage);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('LoginPage', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows a session-expired notice when redirected with reason=session-expired', async () => {
    const el = await setup('session-expired');
    expect(el.textContent).toContain('Your session has expired');
  });

  it('shows no notice on a plain visit', async () => {
    const el = await setup(null);
    expect(el.textContent).not.toContain('Your session has expired');
  });
});
