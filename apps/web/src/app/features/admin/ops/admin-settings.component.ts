import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/ui/toast.service';
import { environment } from '../../../../environments/environment';
import type { SystemSetting } from '../../../core/models/domain.model';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';

const INITIAL_SETTINGS: SystemSetting[] = [
  { id: 'st-001', key: 'seat_hold_minutes', value: '15', category: 'Booking', isPublic: true, description: 'How long selected seats stay held during checkout (BR-13).' },
  { id: 'st-002', key: 'check_in_opens_hours', value: '24', category: 'Check-in', isPublic: true, description: 'Hours before departure when online check-in opens.' },
  { id: 'st-003', key: 'default_currency', value: 'EUR', category: 'Pricing', isPublic: true, description: 'Currency used for fares and payments.' },
  { id: 'st-004', key: 'cancellation_fee_percent', value: '10', category: 'Booking', isPublic: false, description: 'Default cancellation fee for refundable fares.' },
];

@Component({
  selector: 'na-admin-settings',
  standalone: true,
  imports: [FormsModule, NaBreadcrumbs, NaButton, NaBadge, NaAlert, NaSkeleton, NaEmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <na-breadcrumbs [items]="crumbs" />
      <header class="page__head">
        <h1>System Settings</h1>
        <p class="page__sub">
          Runtime configuration for the booking platform.
          <na-badge tone="warning">{{ envLabel }}</na-badge>
        </p>
      </header>

      @if (!canManage()) {
        <na-empty-state
          icon="🔒"
          title="Access restricted"
          message="You need the settings:manage permission to change system settings. Contact a Super Admin."
        />
      } @else if (loading()) {
        <na-skeleton [rows]="[1, 2, 3, 4]" height="2.5rem" />
      } @else {
        <na-alert tone="warning" icon="⚙">
          Changes apply immediately in this demo environment. In production, edits are versioned and audit-logged.
        </na-alert>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Key</th>
                <th>Description</th>
                <th>Category</th>
                <th>Value</th>
                <th><span class="na-visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (setting of settings(); track setting.id) {
                <tr>
                  <td data-label="Key" class="na-text-mono">{{ setting.key }}</td>
                  <td data-label="Description" class="na-text-muted na-text-small">{{ setting.description }}</td>
                  <td data-label="Category"><na-badge tone="neutral">{{ setting.category }}</na-badge></td>
                  <td data-label="Value">
                    @if (editingId() === setting.id) {
                      <label class="na-visually-hidden" [attr.for]="'edit-' + setting.id">New value for {{ setting.key }}</label>
                      <input
                        class="na-input value-input"
                        [id]="'edit-' + setting.id"
                        [ngModel]="editValue()"
                        (ngModelChange)="editValue.set($event)"
                        (keydown.enter)="save(setting)"
                      />
                    } @else {
                      <span class="na-text-mono">{{ setting.value }}</span>
                    }
                  </td>
                  <td data-label="Actions" class="actions">
                    @if (editingId() === setting.id) {
                      <na-button variant="primary" size="sm" (clicked)="save(setting)">Save</na-button>
                      <na-button variant="ghost" size="sm" (clicked)="editingId.set(null)">Cancel</na-button>
                    } @else {
                      <na-button variant="secondary" size="sm" (clicked)="startEdit(setting)">Edit</na-button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .page { max-width: var(--na-admin-max); }
    .page__head { margin-bottom: var(--na-space-6); }
    .page__sub { color: var(--na-ink-500); margin-top: var(--na-space-1); display: flex; align-items: center; gap: var(--na-space-2); flex-wrap: wrap; }
    na-alert { display: block; margin-bottom: var(--na-space-5); }
    .table-wrap { overflow-x: auto; border: 1px solid var(--na-border); border-radius: var(--na-radius-lg); background: var(--na-surface-raised); }
    table { width: 100%; border-collapse: collapse; font-size: var(--na-text-sm); }
    th { text-align: left; padding: var(--na-space-3) var(--na-space-4); font-size: var(--na-text-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--na-ink-500); border-bottom: 1px solid var(--na-border); background: var(--na-surface-sunken); white-space: nowrap; }
    td { padding: var(--na-space-3) var(--na-space-4); border-bottom: 1px solid var(--na-border); vertical-align: middle; }
    .value-input { max-width: 160px; min-height: 40px; }
    .actions { white-space: nowrap; }
    .actions na-button + na-button { margin-left: var(--na-space-2); }
    @media (max-width: 639px) {
      table, thead, tbody, tr, td { display: block; }
      thead { display: none; }
      tr { border-bottom: 1px solid var(--na-border); padding: var(--na-space-2) 0; }
      td { border: none; padding: var(--na-space-1) var(--na-space-4); }
      td::before { content: attr(data-label) ': '; font-weight: var(--na-font-semibold); color: var(--na-ink-500); }
      .value-input { max-width: 100%; }
    }
  `,
})
export class AdminSettingsPage {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly crumbs = [
    { label: 'Overview', link: '/admin/dashboard' },
    { label: 'System Settings' },
  ];

  readonly envLabel = environment.production ? 'PRODUCTION' : 'DEMO';

  readonly canManage = computed(() => this.auth.hasPermission('settings:manage'));
  readonly loading = signal(true);
  readonly settings = signal<SystemSetting[]>([]);
  readonly editingId = signal<string | null>(null);
  readonly editValue = signal('');

  constructor() {
    setTimeout(() => {
      this.settings.set(INITIAL_SETTINGS.map((s) => ({ ...s })));
      this.loading.set(false);
    }, 300);
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
    this.settings.update((list) => list.map((s) => (s.id === setting.id ? { ...s, value } : s)));
    this.editingId.set(null);
    this.toast.success(`Setting ${setting.key} updated to "${value}".`);
  }
}
