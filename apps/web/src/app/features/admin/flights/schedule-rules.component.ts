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
} from './schedule-rule-api.model';
import { CatalogService } from '../catalog/catalog.service';
import { ScheduleRulesService } from './schedule-rules.service';
import type { StatusTone } from '../../../core/status-maps';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
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
  templateUrl: './schedule-rules.component.html',
  styleUrl: './schedule-rules.component.css',
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
