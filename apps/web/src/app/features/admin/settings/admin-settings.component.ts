import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/ui/toast.service';
import { environment } from '../../../../environments/environment';
import type { SystemSetting } from '../../../core/models/domain.model';
import { SettingsService } from './settings.service';
import { toErrorMessage } from '../../../shared/utils/http-error-message';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';

@Component({
  selector: 'na-admin-settings',
  standalone: true,
  imports: [FormsModule, NaBreadcrumbs, NaButton, NaBadge, NaAlert, NaSkeleton, NaEmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-settings.component.html',
  styleUrl: './admin-settings.component.css',
})
export class AdminSettingsPage {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly settingsService = inject(SettingsService);

  readonly crumbs = [{ label: 'Overview', link: '/admin/dashboard' }, { label: 'System Settings' }];

  readonly envLabel = environment.production ? 'PRODUCTION' : 'DEMO';

  readonly canManage = computed(() => this.auth.hasPermission('settings:manage'));
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly settings = signal<SystemSetting[]>([]);
  readonly editingId = signal<string | null>(null);
  readonly editValue = signal('');

  constructor() {
    if (this.canManage()) {
      this.loadSettings();
    } else {
      this.loading.set(false);
    }
  }

  loadSettings(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.settingsService.listSettings().subscribe({
      next: (settings) => {
        this.settings.set(settings);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(toErrorMessage(err, 'Could not load system settings.'));
        this.loading.set(false);
      },
    });
  }

  startEdit(setting: SystemSetting): void {
    this.editingId.set(setting.id);
    this.editValue.set(setting.value);
  }

  save(setting: SystemSetting): void {
    const value = this.editValue().trim();
    if (!value) {
      this.toast.error('A value is required.');
      return;
    }
    this.settingsService.updateSetting(setting.key, value).subscribe({
      next: (updated) => {
        this.settings.update((list) => list.map((s) => (s.id === updated.id ? updated : s)));
        this.editingId.set(null);
        this.toast.success(`Setting ${updated.key} updated to "${updated.value}".`);
      },
      error: (err) => {
        this.toast.error(toErrorMessage(err, `Could not update ${setting.key}.`));
      },
    });
  }
}
