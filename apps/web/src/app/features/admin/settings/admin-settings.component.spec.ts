import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminSettingsPage } from './admin-settings.component';
import { SettingsService } from './settings.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/ui/toast.service';
import type { SystemSetting } from '../../../core/models/domain.model';

function setting(overrides: Partial<SystemSetting> = {}): SystemSetting {
  return {
    id: 'st-1',
    key: 'seat_hold_minutes',
    value: '15',
    category: 'Booking',
    isPublic: true,
    description: 'How long selected seats stay held during checkout.',
    ...overrides,
  };
}

function mocks(settings: SystemSetting[] = [setting()]) {
  return {
    api: {
      listSettings: vi.fn().mockReturnValue(of(settings)),
      updateSetting: vi
        .fn()
        .mockImplementation((key: string, value: string) => of({ ...setting(), key, value })),
    },
    auth: { hasPermission: vi.fn().mockReturnValue(true) },
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  };
}

type Mocks = ReturnType<typeof mocks>;

async function setup(m: Mocks): Promise<ComponentFixture<AdminSettingsPage>> {
  await TestBed.configureTestingModule({
    imports: [AdminSettingsPage],
    providers: [
      provideRouter([]),
      { provide: SettingsService, useValue: m.api },
      { provide: AuthService, useValue: m.auth },
      { provide: ToastService, useValue: m.toast },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(AdminSettingsPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

async function settle(fixture: ComponentFixture<AdminSettingsPage>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

function buttonByText(root: HTMLElement, text: string): HTMLButtonElement | null {
  return (
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === text,
    ) ?? null
  );
}

describe('AdminSettingsPage', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('loads settings from the API and renders rows', async () => {
    const m = mocks([
      setting(),
      setting({ id: 'st-2', key: 'default_currency', value: 'EUR', category: 'Pricing' }),
    ]);
    const fixture = await setup(m);
    const root = fixture.nativeElement as HTMLElement;

    expect(m.api.listSettings).toHaveBeenCalledOnce();
    expect(root.textContent).toContain('seat_hold_minutes');
    expect(root.textContent).toContain('default_currency');
    expect(root.textContent).toContain('EUR');
  });

  it('saves an edit through the API and updates the row from the response', async () => {
    const m = mocks();
    m.api.updateSetting.mockReturnValue(of(setting({ value: '20' })));
    const fixture = await setup(m);
    const root = fixture.nativeElement as HTMLElement;

    buttonByText(root, 'Edit')!.click();
    await settle(fixture);

    const input = root.querySelector<HTMLInputElement>('.value-input')!;
    input.value = '20';
    input.dispatchEvent(new Event('input'));
    await settle(fixture);

    buttonByText(root, 'Save')!.click();
    await settle(fixture);

    expect(m.api.updateSetting).toHaveBeenCalledWith('seat_hold_minutes', '20');
    expect(root.textContent).toContain('20');
    expect(m.toast.success).toHaveBeenCalled();
  });

  it('shows an error state with retry when the list fails to load', async () => {
    const m = mocks();
    m.api.listSettings
      .mockReturnValueOnce(throwError(() => ({ status: 500 })))
      .mockReturnValue(of([setting()]));
    const fixture = await setup(m);
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Could not load settings');

    buttonByText(root, 'Try again')!.click();
    await settle(fixture);

    expect(m.api.listSettings).toHaveBeenCalledTimes(2);
    expect(root.textContent).toContain('seat_hold_minutes');
  });

  it('shows an access-restricted state without settings:manage permission', async () => {
    const m = mocks();
    m.auth.hasPermission.mockReturnValue(false);
    const fixture = await setup(m);
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Access restricted');
    expect(m.api.listSettings).not.toHaveBeenCalled();
  });
});
