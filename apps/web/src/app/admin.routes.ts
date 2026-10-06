import { Routes } from '@angular/router';
import { AdminShell } from './features/admin/admin-shell.component';
import { guestGuard, staffGuard, permissionGuard } from './core/guards/auth.guard';

/**
 * Admin console routes — owned by Developer B (Operations & Platform).
 * Children of the top-level `/admin` path (see app.routes.ts). Paths, guards,
 * permission checks and lazy loading are unchanged from the monolithic router.
 */
export const ADMIN_ROUTES: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/admin/admin-login.component').then((m) => m.AdminLoginPage),
  },
  {
    path: '',
    component: AdminShell,
    canActivate: [staffGuard],
    children: [
      { path: 'denied', loadComponent: () => import('./features/admin/denied.component').then((m) => m.DeniedPage) },
      { path: 'dashboard', loadComponent: () => import('./features/admin/dashboard/dashboard.component').then((m) => m.DashboardPage), canActivate: [permissionGuard('dashboard:read')] },
      { path: 'flights', loadComponent: () => import('./features/admin/flights/flights.component').then((m) => m.FlightsPage), canActivate: [permissionGuard('flights:read')] },
      { path: 'schedule-rules', loadComponent: () => import('./features/admin/flights/schedule-rules.component').then((m) => m.ScheduleRulesPage), canActivate: [permissionGuard('flights:read')] },
      { path: 'airports', loadComponent: () => import('./features/admin/catalog/airports.component').then((m) => m.AirportsPage), canActivate: [permissionGuard('airports:manage')] },
      { path: 'aircraft', loadComponent: () => import('./features/admin/catalog/aircraft.component').then((m) => m.AircraftPage), canActivate: [permissionGuard('aircraft:manage')] },
      { path: 'routes', loadComponent: () => import('./features/admin/catalog/routes.component').then((m) => m.RoutesPage), canActivate: [permissionGuard('routes:manage')] },
      { path: 'bookings', loadComponent: () => import('./features/admin/bookings/admin-bookings.component').then((m) => m.AdminBookingsPage), canActivate: [permissionGuard('bookings:read')] },
      { path: 'users', loadComponent: () => import('./features/admin/users/admin-users.component').then((m) => m.AdminUsersPage), canActivate: [permissionGuard('users:read')] },
      { path: 'staff', loadComponent: () => import('./features/admin/users/admin-staff.component').then((m) => m.AdminStaffPage), canActivate: [permissionGuard('staff:manage')] },
      { path: 'roles', loadComponent: () => import('./features/admin/users/admin-roles.component').then((m) => m.AdminRolesPage), canActivate: [permissionGuard('roles:manage')] },
      { path: 'payments', loadComponent: () => import('./features/admin/payments/admin-payments.component').then((m) => m.AdminPaymentsPage), canActivate: [permissionGuard('payments:read')] },
      { path: 'refunds', loadComponent: () => import('./features/admin/payments/admin-refunds.component').then((m) => m.AdminRefundsPage), canActivate: [permissionGuard('payments:refund')] },
      { path: 'baggage', loadComponent: () => import('./features/admin/baggage/admin-baggage.component').then((m) => m.AdminBaggagePage), canActivate: [permissionGuard('baggage:manage')] },
      { path: 'checkin', loadComponent: () => import('./features/admin/checkin/admin-checkin.component').then((m) => m.AdminCheckInPage), canActivate: [permissionGuard('checkin:manage')] },
      { path: 'loyalty', loadComponent: () => import('./features/admin/loyalty/admin-loyalty.component').then((m) => m.AdminLoyaltyPage), canActivate: [permissionGuard('loyalty:manage')] },
      { path: 'offers', loadComponent: () => import('./features/admin/offers/admin-offers.component').then((m) => m.AdminOffersPage), canActivate: [permissionGuard('offers:manage')] },
      { path: 'notifications', loadComponent: () => import('./features/admin/notifications/admin-notifications.component').then((m) => m.AdminNotificationsPage), canActivate: [permissionGuard('notifications:manage')] },
      { path: 'reports', loadComponent: () => import('./features/admin/reports/admin-reports.component').then((m) => m.AdminReportsPage), canActivate: [permissionGuard('reports:read')] },
      { path: 'audit', loadComponent: () => import('./features/admin/audit/admin-audit.component').then((m) => m.AdminAuditPage), canActivate: [permissionGuard('audit:read')] },
      { path: 'settings', loadComponent: () => import('./features/admin/settings/admin-settings.component').then((m) => m.AdminSettingsPage), canActivate: [permissionGuard('settings:manage')] },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
];
