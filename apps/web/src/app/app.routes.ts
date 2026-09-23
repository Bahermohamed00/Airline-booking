import { Routes } from '@angular/router';
import { CustomerShell } from './features/customer/customer-shell.component';
import { AdminShell } from './features/admin/admin-shell.component';
import { authGuard, staffGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'admin',
    children: [
      {
        path: 'login',
        loadComponent: () => import('./features/admin/admin-login.component').then((m) => m.AdminLoginPage),
      },
      {
        path: '',
        component: AdminShell,
        canActivate: [staffGuard],
        children: [
          { path: 'denied', loadComponent: () => import('./features/admin/denied.component').then((m) => m.DeniedPage) },
          { path: 'dashboard', loadComponent: () => import('./features/admin/dashboard/dashboard.component').then((m) => m.DashboardPage) },
          { path: 'flights', loadComponent: () => import('./features/admin/flights/flights.component').then((m) => m.FlightsPage) },
          { path: 'airports', loadComponent: () => import('./features/admin/catalog/airports.component').then((m) => m.AirportsPage) },
          { path: 'aircraft', loadComponent: () => import('./features/admin/catalog/aircraft.component').then((m) => m.AircraftPage) },
          { path: 'routes', loadComponent: () => import('./features/admin/catalog/routes.component').then((m) => m.RoutesPage) },
          { path: 'bookings', loadComponent: () => import('./features/admin/ops/admin-bookings.component').then((m) => m.AdminBookingsPage) },
          { path: 'users', loadComponent: () => import('./features/admin/ops/admin-users.component').then((m) => m.AdminUsersPage) },
          { path: 'staff', loadComponent: () => import('./features/admin/ops/admin-staff.component').then((m) => m.AdminStaffPage) },
          { path: 'roles', loadComponent: () => import('./features/admin/ops/admin-roles.component').then((m) => m.AdminRolesPage) },
          { path: 'payments', loadComponent: () => import('./features/admin/ops/admin-payments.component').then((m) => m.AdminPaymentsPage) },
          { path: 'refunds', loadComponent: () => import('./features/admin/ops/admin-refunds.component').then((m) => m.AdminRefundsPage) },
          { path: 'baggage', loadComponent: () => import('./features/admin/ops/admin-baggage.component').then((m) => m.AdminBaggagePage) },
          { path: 'checkin', loadComponent: () => import('./features/admin/ops/admin-checkin.component').then((m) => m.AdminCheckInPage) },
          { path: 'loyalty', loadComponent: () => import('./features/admin/ops/admin-loyalty.component').then((m) => m.AdminLoyaltyPage) },
          { path: 'notifications', loadComponent: () => import('./features/admin/ops/admin-notifications.component').then((m) => m.AdminNotificationsPage) },
          { path: 'reports', loadComponent: () => import('./features/admin/ops/admin-reports.component').then((m) => m.AdminReportsPage) },
          { path: 'audit', loadComponent: () => import('./features/admin/ops/admin-audit.component').then((m) => m.AdminAuditPage) },
          { path: 'settings', loadComponent: () => import('./features/admin/ops/admin-settings.component').then((m) => m.AdminSettingsPage) },
          { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
        ],
      },
    ],
  },
  {
    path: '',
    component: CustomerShell,
    children: [
      { path: 'search', loadComponent: () => import('./features/customer/booking/search.component').then((m) => m.SearchPage) },
      { path: 'results', loadComponent: () => import('./features/customer/booking/results.component').then((m) => m.ResultsPage) },
      { path: 'flights/:id', loadComponent: () => import('./features/customer/booking/flight-details.component').then((m) => m.FlightDetailsPage) },
      { path: 'booking/passengers', loadComponent: () => import('./features/customer/booking/passengers.component').then((m) => m.PassengersPage) },
      { path: 'booking/seats', loadComponent: () => import('./features/customer/booking/seats.component').then((m) => m.SeatsPage) },
      { path: 'booking/extras', loadComponent: () => import('./features/customer/booking/extras.component').then((m) => m.ExtrasPage) },
      { path: 'booking/review', loadComponent: () => import('./features/customer/booking/review.component').then((m) => m.ReviewPage) },
      { path: 'booking/confirmation', loadComponent: () => import('./features/customer/booking/confirmation.component').then((m) => m.ConfirmationPage) },
      { path: 'login', loadComponent: () => import('./features/customer/login.component').then((m) => m.LoginPage) },
      { path: 'register', loadComponent: () => import('./features/customer/register.component').then((m) => m.RegisterPage) },
      { path: 'bookings', loadComponent: () => import('./features/customer/my-bookings.component').then((m) => m.MyBookingsPage), canActivate: [authGuard] },
      { path: 'bookings/:id', loadComponent: () => import('./features/customer/manage-booking.component').then((m) => m.ManageBookingPage), canActivate: [authGuard] },
      { path: 'manage', loadComponent: () => import('./features/customer/manage-lookup.component').then((m) => m.ManageLookupPage) },
      { path: 'checkin', loadComponent: () => import('./features/customer/checkin.component').then((m) => m.CheckInPage) },
      { path: 'checkin/:bookingId/pass', loadComponent: () => import('./features/customer/boarding-pass.component').then((m) => m.BoardingPassPage) },
      { path: 'status', loadComponent: () => import('./features/customer/flight-status.component').then((m) => m.FlightStatusPage) },
      { path: 'baggage', loadComponent: () => import('./features/customer/baggage.component').then((m) => m.BaggagePage) },
      { path: 'loyalty', loadComponent: () => import('./features/customer/loyalty.component').then((m) => m.LoyaltyPage), canActivate: [authGuard] },
      { path: 'profile', loadComponent: () => import('./features/customer/profile.component').then((m) => m.ProfilePage), canActivate: [authGuard] },
      { path: 'profile/:section', loadComponent: () => import('./features/customer/profile.component').then((m) => m.ProfilePage), canActivate: [authGuard] },
      { path: 'help', loadComponent: () => import('./features/customer/help.component').then((m) => m.HelpPage) },
      { path: '', pathMatch: 'full', redirectTo: 'search' },
    ],
  },
  { path: '**', loadComponent: () => import('./features/customer/help.component').then((m) => m.HelpPage) },
];
