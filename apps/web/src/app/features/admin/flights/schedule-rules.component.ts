import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import type { Aircraft, Route } from '../../../core/models/domain.model';
import {
  type CreateScheduleRulePayload,
  type ScheduleRule,
  type ScheduleRuleStatus,
  type UpdateScheduleRulePayload,
  type Weekday,
} from '../../../core/models/schedule-rule-api.model';
import { CatalogService } from '../../../core/services/catalog.service';
import { ScheduleRulesService } from '../../../core/services/schedule-rules.service';
import type { StatusTone } from '../../../core/status-maps';
import { HasPermissionDirective } from '../../../core/directives/has-permission.directive';
import { toErrorMessage } from '../../../shared/utils/http-error-message';
import { ToastService } from '../../../shared/ui/toast.service';
import { NaBreadcrumbs } from '../../../shared/ui/breadcrumbs.component';
import { NaButton } from '../../../shared/ui/button.component';
import { NaBadge } from '../../../shared/ui/badge.component';
import { NaDialog } from '../../../shared/ui/dialog.component';
import { NaSkeleton } from '../../../shared/ui/skeleton.component';
import { NaEmptyState } from '../../../shared/ui/empty-state.component';

const WEEKDAYS: Weekday[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const FLIGHT_NUMBER_PATTERN = /^NV\d{3,4}$/;
const LOCAL_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DUPLICATE_FLIGHT_NUMBER_MESSAGE = 'A schedule rule with this flight number already exists.';

const STATUS_TONE: Record<ScheduleRuleStatus, StatusTone> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
};

@Component({
  selector: 'na-admin-schedule-rules',
  imports: [
    FormsModule,
    NaBreadcrumbs,
    NaButton,
    NaBadge,
    NaDialog,
    NaSkeleton,
    NaEmptyState,
    HasPermissionDirective,
  ],
  template: `
    <div class="page">
      <na-breadcrumbs
        [items]="[{ label: 'Overview', link: '/admin/dashboard' }, { label: 'Schedule Rules' }]"
      />
      <header class="page__head">
        <div>
          <h1>Schedule rules</h1>
          <p class="subtitle">
            Recurring flight definitions. Flights are materialized from ACTIVE rules via generation
            on the Flights page — rules cannot be deleted, only deactivated.
          </p>
        </div>
        <na-button variant="cta" *naHasPermission="'flights:manage'" (clicked)="openCreate()"
          >New rule</na-button
        >
      </header>

      @if (loading()) {
        <na-skeleton [rows]="[1, 2, 3, 4, 5]" height="2.5rem" />
      } @else if (loadError()) {
        <div class="list-error" role="alert">
          <p>{{ loadError() }}</p>
          <na-button variant="secondary" (clicked)="load()">Retry</na-button>
        </div>
      } @else if (rules().length === 0) {
        <na-empty-state
          title="No schedule rules"
          message="Create the first schedule rule, then generate flights from it on the Flights page."
        />
      } @else {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Flight</th>
                <th>Route</th>
                <th>Aircraft</th>
                <th>Departure</th>
                <th>Days</th>
                <th>Effective</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (r of rules(); track r.id) {
                <tr>
                  <td data-label="Flight">
                    <span class="na-text-mono rule-number">{{ r.flightNumber }}</span>
                  </td>
                  <td data-label="Route">{{ r.originIata }} → {{ r.destinationIata }}</td>
                  <td data-label="Aircraft">{{ r.aircraftRegistration }}</td>
                  <td data-label="Departure">{{ r.departureTimeLocal }}</td>
                  <td data-label="Days">{{ daysLabel(r.operatingDays) }}</td>
                  <td data-label="Effective">
                    {{ dateOf(r.effectiveFrom) }} → {{ dateOf(r.effectiveTo) }}
                  </td>
                  <td data-label="Status">
                    <na-badge [tone]="toneOf(r.status)">{{ r.status }}</na-badge>
                  </td>
                  <td data-label="Actions">
                    <div class="row-actions" *naHasPermission="'flights:manage'">
                      <na-button variant="secondary" size="sm" (clicked)="openEdit(r)"
                        >Edit</na-button
                      >
                      <na-button
                        [variant]="r.status === 'ACTIVE' ? 'danger' : 'primary'"
                        size="sm"
                        (clicked)="askToggle(r)"
                      >
                        {{ r.status === 'ACTIVE' ? 'Deactivate' : 'Activate' }}
                      </na-button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- Create / edit drawer -->
      @if (drawerOpen()) {
        <div class="backdrop" (click)="closeDrawer()" role="presentation"></div>
        <aside
          class="drawer"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="editing() ? 'Edit schedule rule' : 'New schedule rule'"
        >
          <header class="drawer__head">
            <h2>{{ editing() ? 'Edit rule' : 'New rule' }}</h2>
            <button
              type="button"
              class="drawer__close"
              aria-label="Close form"
              (click)="closeDrawer()"
            >
              ×
            </button>
          </header>
          <form class="drawer__body" (submit)="save($event)">
            <div class="na-field">
              <label class="na-label" for="sr-number">Flight number</label>
              <input
                id="sr-number"
                class="na-input"
                name="srNumber"
                [(ngModel)]="formFlightNumber"
                placeholder="NV720"
                required
              />
              <p class="na-hint">NV followed by 3–4 digits; stored uppercase.</p>
            </div>
            <div class="na-field">
              <label class="na-label" for="sr-route">Route</label>
              <select
                id="sr-route"
                class="na-select"
                name="srRoute"
                [(ngModel)]="formRouteId"
                required
              >
                <option value="" disabled>Select a route…</option>
                @for (r of routes(); track r.id) {
                  <option [value]="r.id">
                    {{ r.origin.iataCode }} → {{ r.destination.iataCode }} ({{ r.origin.city }} –
                    {{ r.destination.city }})
                  </option>
                }
              </select>
            </div>
            <div class="na-field">
              <label class="na-label" for="sr-aircraft">Aircraft</label>
              <select
                id="sr-aircraft"
                class="na-select"
                name="srAircraft"
                [(ngModel)]="formAircraftId"
                required
              >
                <option value="" disabled>Select an aircraft…</option>
                @for (a of fleet(); track a.id) {
                  <option [value]="a.id">
                    {{ a.registration }} — {{ a.model }} ({{ a.capacity }} seats)
                  </option>
                }
              </select>
            </div>
            <div class="na-field">
              <label class="na-label" for="sr-time">Departure time (origin-local)</label>
              <input
                id="sr-time"
                class="na-input"
                type="time"
                name="srTime"
                [(ngModel)]="formDepartureTime"
                required
              />
            </div>
            <fieldset class="na-field days">
              <legend class="na-label">Operating days</legend>
              <div class="days__row" role="group" aria-label="Operating days">
                @for (d of weekdays; track d) {
                  <button
                    type="button"
                    class="day"
                    [class.day--on]="formDays().includes(d)"
                    [attr.aria-pressed]="formDays().includes(d)"
                    (click)="toggleDay(d)"
                  >
                    {{ d }}
                  </button>
                }
              </div>
            </fieldset>
            <div class="form-grid">
              <div class="na-field">
                <label class="na-label" for="sr-from">Effective from</label>
                <input
                  id="sr-from"
                  class="na-input"
                  type="date"
                  name="srFrom"
                  [(ngModel)]="formEffectiveFrom"
                  required
                />
              </div>
              <div class="na-field">
                <label class="na-label" for="sr-to">Effective to</label>
                <input
                  id="sr-to"
                  class="na-input"
                  type="date"
                  name="srTo"
                  [(ngModel)]="formEffectiveTo"
                  required
                />
              </div>
            </div>
            @if (formError()) {
              <p class="na-error" role="alert">{{ formError() }}</p>
            }
            <div class="drawer__actions">
              <na-button variant="secondary" (clicked)="closeDrawer()">Cancel</na-button>
              <na-button variant="cta" type="submit" [disabled]="saving()" [loading]="saving()">
                {{ editing() ? 'Save changes' : 'Create rule' }}
              </na-button>
            </div>
          </form>
        </aside>
      }

      <na-dialog
        [open]="toggling() !== null"
        [title]="toggling()?.status === 'ACTIVE' ? 'Deactivate this rule?' : 'Activate this rule?'"
        [confirmLabel]="toggling()?.status === 'ACTIVE' ? 'Deactivate' : 'Activate'"
        [confirmDanger]="toggling()?.status === 'ACTIVE'"
        (confirmed)="confirmToggle()"
        (cancelled)="toggling.set(null)"
      >
        @if (toggling(); as r) {
          {{ r.flightNumber }} ({{ r.originIata }} → {{ r.destinationIata }}) will
          {{
            r.status === 'ACTIVE'
              ? 'stop producing flights the next time generation runs; already-generated flights are kept'
              : 'be included the next time flights are generated'
          }}.
        }
      </na-dialog>
    </div>
  `,
  styles: `
    .page {
      display: flex;
      flex-direction: column;
      gap: var(--na-space-5);
    }
    .page__head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--na-space-4);
      flex-wrap: wrap;
    }
    .subtitle {
      color: var(--na-ink-500);
      margin-top: var(--na-space-1);
      max-width: 64ch;
    }
    .list-error {
      display: flex;
      align-items: center;
      gap: var(--na-space-4);
      padding: var(--na-space-4);
      border: 1px solid var(--na-border);
      border-radius: var(--na-radius-lg);
      background: var(--na-surface-raised);
    }
    .list-error p {
      margin: 0;
      color: var(--na-ink-500);
    }
    .table-wrap {
      overflow-x: auto;
      border: 1px solid var(--na-border);
      border-radius: var(--na-radius-lg);
      background: var(--na-surface-raised);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--na-text-sm);
    }
    th {
      text-align: left;
      padding: var(--na-space-3) var(--na-space-4);
      font-size: var(--na-text-xs);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--na-ink-500);
      border-bottom: 1px solid var(--na-border);
      background: var(--na-surface-sunken);
      white-space: nowrap;
    }
    td {
      padding: var(--na-space-3) var(--na-space-4);
      border-bottom: 1px solid var(--na-border);
      vertical-align: middle;
    }
    tbody tr:last-child td {
      border-bottom: none;
    }
    .rule-number {
      font-weight: var(--na-font-bold);
    }
    .row-actions {
      display: flex;
      gap: var(--na-space-2);
    }
    .backdrop {
      position: fixed;
      inset: 0;
      background: var(--na-overlay);
      z-index: 99;
    }
    .drawer {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      z-index: 100;
      width: min(480px, 100vw);
      background: var(--na-surface-raised);
      border-left: 1px solid var(--na-border);
      box-shadow: var(--na-shadow-lg);
      display: flex;
      flex-direction: column;
    }
    .drawer__head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--na-space-3);
      padding: var(--na-space-5);
      border-bottom: 1px solid var(--na-border);
    }
    .drawer__close {
      background: none;
      border: none;
      font-size: 1.6rem;
      line-height: 1;
      color: var(--na-ink-500);
      min-width: 44px;
      min-height: 44px;
    }
    .drawer__body {
      padding: var(--na-space-5);
      overflow-y: auto;
    }
    .drawer__actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--na-space-3);
      margin-top: var(--na-space-4);
    }
    .form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 var(--na-space-4);
    }
    .days {
      border: none;
      padding: 0;
      margin: 0 0 var(--na-space-4);
    }
    .days__row {
      display: flex;
      gap: var(--na-space-2);
      flex-wrap: wrap;
      margin-top: var(--na-space-2);
    }
    .day {
      min-width: 44px;
      min-height: 44px;
      padding: 0 var(--na-space-2);
      border: 1px solid var(--na-border-strong);
      border-radius: var(--na-radius-md);
      background: transparent;
      color: var(--na-ink-700);
      font-weight: var(--na-font-semibold);
      font-size: var(--na-text-xs);
    }
    .day--on {
      background: var(--na-blue-600);
      border-color: var(--na-blue-600);
      color: var(--na-on-accent);
    }
    @media (max-width: 900px) {
      .table-wrap {
        border: none;
        background: transparent;
      }
      table,
      thead,
      tbody,
      tr,
      th,
      td {
        display: block;
      }
      thead {
        display: none;
      }
      tr {
        border: 1px solid var(--na-border);
        border-radius: var(--na-radius-md);
        margin-bottom: var(--na-space-3);
        padding: var(--na-space-2);
        background: var(--na-surface-raised);
      }
      td {
        border: none;
        padding: var(--na-space-2) var(--na-space-3);
      }
      td::before {
        content: attr(data-label);
        display: block;
        font-size: var(--na-text-xs);
        color: var(--na-ink-500);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-bottom: 2px;
      }
    }
    @media (max-width: 639px) {
      .form-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class ScheduleRulesPage {
  private readonly rulesService = inject(ScheduleRulesService);
  private readonly catalog = inject(CatalogService);
  private readonly toast = inject(ToastService);

  readonly weekdays = WEEKDAYS;

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly rules = signal<ScheduleRule[]>([]);
  readonly routes = signal<Route[]>([]);
  readonly fleet = signal<Aircraft[]>([]);

  readonly drawerOpen = signal(false);
  readonly editing = signal<ScheduleRule | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly toggling = signal<ScheduleRule | null>(null);

  formFlightNumber = '';
  formRouteId = '';
  formAircraftId = '';
  formDepartureTime = '';
  readonly formDays = signal<Weekday[]>([]);
  formEffectiveFrom = '';
  formEffectiveTo = '';

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    // Routes and aircraft feed the form selects, so they load once together
    // with the rules; any failure surfaces through the same retryable error.
    forkJoin({
      rules: this.rulesService.listRules(),
      routes: this.catalog.listRoutes(),
      aircraft: this.catalog.listAircraft(),
    }).subscribe({
      next: ({ rules, routes, aircraft }) => {
        this.rules.set(rules);
        this.routes.set(routes);
        this.fleet.set(aircraft);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loadError.set(toErrorMessage(err, 'Could not load schedule rules.'));
        this.loading.set(false);
      },
    });
  }

  daysLabel(days: Weekday[]): string {
    if (days.length === 7) return 'Daily';
    return [...days].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b)).join(', ');
  }

  toneOf(status: ScheduleRuleStatus): StatusTone {
    return STATUS_TONE[status];
  }

  dateOf(iso: string): string {
    return iso.slice(0, 10);
  }

  toggleDay(day: Weekday): void {
    this.formDays.update((days) =>
      days.includes(day) ? days.filter((d) => d !== day) : [...days, day],
    );
  }

  openCreate(): void {
    this.editing.set(null);
    this.formFlightNumber = '';
    this.formRouteId = '';
    this.formAircraftId = '';
    this.formDepartureTime = '';
    this.formDays.set([]);
    this.formEffectiveFrom = '';
    this.formEffectiveTo = '';
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  openEdit(rule: ScheduleRule): void {
    this.editing.set(rule);
    this.formFlightNumber = rule.flightNumber;
    this.formRouteId = rule.routeId;
    this.formAircraftId = rule.aircraftId;
    this.formDepartureTime = rule.departureTimeLocal;
    this.formDays.set([...rule.operatingDays]);
    this.formEffectiveFrom = this.dateOf(rule.effectiveFrom);
    this.formEffectiveTo = this.dateOf(rule.effectiveTo);
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    if (this.saving()) return;
    this.drawerOpen.set(false);
  }

  save(event: Event): void {
    event.preventDefault();
    if (this.saving()) return;
    const flightNumber = this.formFlightNumber.trim().toUpperCase();
    if (!FLIGHT_NUMBER_PATTERN.test(flightNumber)) {
      this.formError.set('Flight number must be NV followed by 3–4 digits (e.g. NV720).');
      return;
    }
    if (!this.formRouteId || !this.formAircraftId) {
      this.formError.set('Both a route and an aircraft are required.');
      return;
    }
    if (!LOCAL_TIME_PATTERN.test(this.formDepartureTime)) {
      this.formError.set('Departure time must be HH:mm (24h, origin-local).');
      return;
    }
    const operatingDays = WEEKDAYS.filter((d) => this.formDays().includes(d));
    if (operatingDays.length === 0) {
      this.formError.set('Select at least one operating day.');
      return;
    }
    if (!this.formEffectiveFrom || !this.formEffectiveTo) {
      this.formError.set('Both effective dates are required.');
      return;
    }
    if (this.formEffectiveFrom > this.formEffectiveTo) {
      this.formError.set('Effective from must be on or before effective to.');
      return;
    }

    this.formError.set(null);
    this.saving.set(true);
    const editing = this.editing();
    const request$ = editing
      ? this.rulesService.updateRule(
          editing.id,
          this.buildUpdatePayload(editing, flightNumber, operatingDays),
        )
      : this.rulesService.createRule(this.buildCreatePayload(flightNumber, operatingDays));

    request$.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.rules.update((list) =>
          editing ? list.map((r) => (r.id === saved.id ? saved : r)) : [...list, saved],
        );
        this.drawerOpen.set(false);
        this.toast.success(
          editing ? `Rule ${saved.flightNumber} updated.` : `Rule ${saved.flightNumber} created.`,
        );
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.formError.set(
          toErrorMessage(
            err,
            'Could not save the schedule rule. Please try again.',
            DUPLICATE_FLIGHT_NUMBER_MESSAGE,
          ),
        );
      },
    });
  }

  askToggle(rule: ScheduleRule): void {
    this.toggling.set(rule);
  }

  confirmToggle(): void {
    const rule = this.toggling();
    this.toggling.set(null);
    if (!rule) return;
    const status: ScheduleRuleStatus = rule.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.rulesService.updateRule(rule.id, { status }).subscribe({
      next: (updated) => {
        this.rules.update((list) => list.map((r) => (r.id === updated.id ? updated : r)));
        this.toast.success(
          status === 'INACTIVE'
            ? `Rule ${updated.flightNumber} deactivated.`
            : `Rule ${updated.flightNumber} activated.`,
        );
      },
      error: (err: unknown) =>
        this.toast.error(toErrorMessage(err, 'Could not update the rule status.')),
    });
  }

  private buildCreatePayload(
    flightNumber: string,
    operatingDays: Weekday[],
  ): CreateScheduleRulePayload {
    return {
      flightNumber,
      routeId: this.formRouteId,
      aircraftId: this.formAircraftId,
      departureTimeLocal: this.formDepartureTime,
      operatingDays,
      effectiveFrom: this.formEffectiveFrom,
      effectiveTo: this.formEffectiveTo,
    };
  }

  private buildUpdatePayload(
    rule: ScheduleRule,
    flightNumber: string,
    operatingDays: Weekday[],
  ): UpdateScheduleRulePayload {
    const payload: UpdateScheduleRulePayload = {};
    if (flightNumber !== rule.flightNumber) payload.flightNumber = flightNumber;
    if (this.formRouteId !== rule.routeId) payload.routeId = this.formRouteId;
    if (this.formAircraftId !== rule.aircraftId) payload.aircraftId = this.formAircraftId;
    if (this.formDepartureTime !== rule.departureTimeLocal)
      payload.departureTimeLocal = this.formDepartureTime;
    if (
      operatingDays.join(',') !==
      [...rule.operatingDays].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b)).join(',')
    ) {
      payload.operatingDays = operatingDays;
    }
    if (this.formEffectiveFrom !== this.dateOf(rule.effectiveFrom))
      payload.effectiveFrom = this.formEffectiveFrom;
    if (this.formEffectiveTo !== this.dateOf(rule.effectiveTo))
      payload.effectiveTo = this.formEffectiveTo;
    return payload;
  }
}
