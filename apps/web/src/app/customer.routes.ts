import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

/**
 * Customer-facing routes — owned by Developer A (Customer & Revenue).
 * Children of the root CustomerShell path (see app.routes.ts). Paths, guards,
 * lazy loading and redirects are unchanged from the monolithic router.
 * Authentication routes (login/register/recovery) are platform functionality
 * and stay within this shell to preserve guard and returnUrl behavior.
 */
export const CUSTOMER_ROUTES: Routes = [
  { path: 'search', loadComponent: () => import('./features/customer/booking/search.component').then((m) => m.SearchPage) },
  { path: 'offers', loadComponent: () => import('./features/customer/offers.component').then((m) => m.OffersPage) },
  { path: 'results', loadComponent: () => import('./features/customer/booking/results.component').then((m) => m.ResultsPage) },
  { path: 'flights/:id', loadComponent: () => import('./features/customer/booking/flight-details.component').then((m) => m.FlightDetailsPage) },
  { path: 'booking/passengers', loadComponent: () => import('./features/customer/booking/passengers.component').then((m) => m.PassengersPage) },
  { path: 'booking/seats', loadComponent: () => import('./features/customer/booking/seats.component').then((m) => m.SeatsPage) },
  { path: 'booking/extras', loadComponent: () => import('./features/customer/booking/extras.component').then((m) => m.ExtrasPage) },
  { path: 'booking/review', loadComponent: () => import('./features/customer/booking/review.component').then((m) => m.ReviewPage), canActivate: [authGuard] },
  { path: 'booking/confirmation', loadComponent: () => import('./features/customer/booking/confirmation.component').then((m) => m.ConfirmationPage), canActivate: [authGuard] },
  { path: 'login', loadComponent: () => import('./features/customer/login.component').then((m) => m.LoginPage), canActivate: [guestGuard] },
  { path: 'register', loadComponent: () => import('./features/customer/register.component').then((m) => m.RegisterPage), canActivate: [guestGuard] },
  { path: 'forgot-password', loadComponent: () => import('./features/customer/forgot-password.component').then((m) => m.ForgotPasswordPage), canActivate: [guestGuard] },
  { path: 'reset-password', loadComponent: () => import('./features/customer/reset-password.component').then((m) => m.ResetPasswordPage), canActivate: [guestGuard] },
  { path: 'verify-email', loadComponent: () => import('./features/customer/verify-email.component').then((m) => m.VerifyEmailPage) },
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
];
