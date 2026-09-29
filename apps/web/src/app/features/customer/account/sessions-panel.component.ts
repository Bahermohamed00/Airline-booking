import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import type { SessionInfo } from '../../../core/models/domain.model';
import { NaButton } from '../../../shared/ui/button.component';
import { NaAlert } from '../../../shared/ui/alert.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaDialog } from '../../../shared/ui/dialog.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';
import { ToastService } from '../../../shared/ui/toast.service';

@Component({
  selector: 'app-sessions-panel',
  imports: [NaButton, NaAlert, NaBadge, NaSkeleton, NaDialog, NaEmptyState],
  template: `
    <section class="na-card panel" aria-labelledby="sessions-h">
      <header class="panel__head">
        <h2 id="sessions-h" class="panel__title">Sessions &amp; devices</h2>
        <p class="panel__desc">Every device currently signed in to your account. Revoking a session signs that device out immediately.</p>
      </header>

      @if (error()) {
        <na-alert tone="danger" title="Could not load sessions" retryable (retry)="load()">Please try again.</na-alert>
      } @else if (loading()) {
        <na-skeleton [rows]="[1, 2]" height="4rem" />
      } @else if (sessions().length === 0) {
        <na-empty-state icon="📱" title="No active sessions" message="Devices you sign in with will appear here." />
      } @else {
        <ul class="session-list">
          @for (s of sessions(); track s.id) {
            <li class="session-row">
              <span class="session-row__icon" aria-hidden="true">{{ deviceIcon(s.userAgent) }}</span>
              <div class="session-row__meta">
                <p class="session-row__device">
                  {{ deviceLabel(s.userAgent) }}
                  @if (s.current) { <na-badge tone="success">Current session</na-badge> }
                </p>
                <p class="session-row__detail">Last active {{ formatDate(s.lastUsedAt) }} · Signed in {{ formatDate(s.createdAt) }}</p>
                <p class="session-row__detail na-text-mono">{{ s.ipAddress ?? 'IP unknown' }}</p>
              </div>
              @if (!s.current) {
                <na-button variant="secondary" size="sm" [loading]="actionLoading()" (clicked)="revokeTarget.set(s)">Revoke</na-button>
              }
            </li>
          }
        </ul>

        <footer class="panel__foot">
          <na-button variant="danger" [loading]="actionLoading()" (clicked)="logoutAllOpen.set(true)">Log out all sessions</na-button>
          <p class="na-text-muted na-text-small">This signs you out everywhere, including this device.</p>
        </footer>
      }
    </section>

    <na-dialog
      [open]="revokeTarget() !== null"
      title="Revoke this session?"
      confirmLabel="Revoke session"
      [confirmDanger]="true"
      (cancelled)="revokeTarget.set(null)"
      (confirmed)="confirmRevoke()"
    >
      <p>{{ revokeTarget() ? deviceLabel(revokeTarget()!.userAgent) : '' }} will be signed out immediately.</p>
    </na-dialog>

    <na-dialog
      [open]="logoutAllOpen()"
      title="Log out of all sessions?"
      confirmLabel="Log out everywhere"
      [confirmDanger]="true"
      (cancelled)="logoutAllOpen.set(false)"
      (confirmed)="confirmLogoutAll()"
    >
      <p>Every device — including this one — will be signed out. You can sign back in at any time.</p>
    </na-dialog>
  `,
  styles: `
    .panel { padding: var(--na-space-6); }
    .panel__head { border-bottom: 1px solid var(--na-border); padding-bottom: var(--na-space-4); margin-bottom: var(--na-space-5); }
    .panel__title { font-size: var(--na-text-xl); margin-bottom: var(--na-space-1); }
    .panel__desc { color: var(--na-ink-500); font-size: var(--na-text-sm); }
    .panel__foot { margin-top: var(--na-space-6); padding-top: var(--na-space-5); border-top: 1px solid var(--na-border); display: grid; gap: var(--na-space-2); justify-items: start; }

    .session-list { list-style: none; margin: 0; padding: 0; }
    .session-row {
      display: flex; align-items: center; gap: var(--na-space-4);
      padding: var(--na-space-4) 0; border-bottom: 1px solid var(--na-border);
    }
    .session-row:first-child { padding-top: var(--na-space-1); }
    .session-row:last-child { border-bottom: none; padding-bottom: 0; }
    .session-row__icon { font-size: 1.5rem; flex-shrink: 0; }
    .session-row__meta { flex: 1; min-width: 0; }
    .session-row__device { font-weight: var(--na-font-semibold); margin-bottom: var(--na-space-1); display: flex; align-items: center; gap: var(--na-space-2); flex-wrap: wrap; }
    .session-row__detail { color: var(--na-ink-500); font-size: var(--na-text-sm); }
    .session-row na-button { flex-shrink: 0; }

    @media (max-width: 639px) {
      .panel { padding: var(--na-space-5); }
      .session-row { align-items: flex-start; }
      .session-row na-button { align-self: center; }
    }
  `,
})
export class SessionsPanel implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly sessions = signal<SessionInfo[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly actionLoading = signal(false);
  readonly revokeTarget = signal<SessionInfo | null>(null);
  readonly logoutAllOpen = signal(false);

  private readonly dateFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.auth.listSessions().subscribe({
      next: (sessions) => {
        this.sessions.set(sessions);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  confirmRevoke(): void {
    const target = this.revokeTarget();
    if (!target || this.actionLoading()) return;
    this.actionLoading.set(true);
    this.auth.revokeSession(target.id).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.revokeTarget.set(null);
        this.toast.success('Session revoked.');
        this.load();
      },
      error: (err) => {
        this.actionLoading.set(false);
        this.revokeTarget.set(null);
        this.toast.error(err?.message ?? 'Could not revoke the session. Please try again.');
      },
    });
  }

  confirmLogoutAll(): void {
    if (this.actionLoading()) return;
    this.actionLoading.set(true);
    this.auth.logoutAll().subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.logoutAllOpen.set(false);
        this.toast.success('Logged out of all sessions.');
        void this.router.navigate(['/login']);
      },
      error: (err) => {
        this.actionLoading.set(false);
        this.logoutAllOpen.set(false);
        this.toast.error(err?.message ?? 'Could not log out everywhere. Please try again.');
      },
    });
  }

  formatDate(iso: string): string {
    return this.dateFmt.format(new Date(iso));
  }

  deviceIcon(userAgent: string | null): string {
    if (!userAgent) return '❓';
    return /Mobile|Android|iPhone|iPad/i.test(userAgent) ? '📱' : '💻';
  }

  deviceLabel(userAgent: string | null): string {
    if (!userAgent) return 'Unknown device';
    const browser = userAgent.includes('Edg')
      ? 'Edge'
      : userAgent.includes('Chrome')
        ? 'Chrome'
        : userAgent.includes('Firefox')
          ? 'Firefox'
          : userAgent.includes('Safari')
            ? 'Safari'
            : 'Browser';
    const os = userAgent.includes('Windows')
      ? 'Windows'
      : userAgent.includes('Android')
        ? 'Android'
        : userAgent.includes('iPhone') || userAgent.includes('iPad')
          ? 'iOS'
          : userAgent.includes('Mac OS')
            ? 'macOS'
            : userAgent.includes('Linux')
              ? 'Linux'
              : '';
    return os ? `${browser} on ${os}` : browser;
  }
}
