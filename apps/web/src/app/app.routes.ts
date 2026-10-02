import { Routes } from '@angular/router';
import { CustomerShell } from './features/customer/customer-shell.component';
import { ADMIN_ROUTES } from './admin.routes';
import { CUSTOMER_ROUTES } from './customer.routes';

/**
 * Thin root router: high-level route composition only. Domain routes live in
 * admin.routes.ts (Developer B) and customer.routes.ts (Developer A) so the two
 * developers can edit routing without conflicting on this file. Paths, guards,
 * shells, lazy loading and redirects are unchanged from the monolithic router.
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomePage),
  },
  {
    path: 'admin',
    children: ADMIN_ROUTES,
  },
  {
    path: '',
    component: CustomerShell,
    children: CUSTOMER_ROUTES,
  },
  { path: '**', loadComponent: () => import('./features/customer/help.component').then((m) => m.HelpPage) },
];
