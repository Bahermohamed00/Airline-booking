// Centralized admin navigation with permission requirements. The sidebar
// renders only entries the current staff user may access.

export interface AdminNavItem {
  route: string;
  label: string;
  icon: string;
  permission: string;
}

export const ADMIN_NAV: AdminNavItem[] = [
  { route: '/admin/dashboard', label: 'Overview', icon: '▤', permission: 'dashboard:read' },
  { route: '/admin/flights', label: 'Flights', icon: '✈', permission: 'flights:read' },
  { route: '/admin/routes', label: 'Routes', icon: '⇄', permission: 'routes:manage' },
  { route: '/admin/airports', label: 'Airports', icon: '⌂', permission: 'airports:manage' },
  { route: '/admin/aircraft', label: 'Aircraft', icon: '▲', permission: 'aircraft:manage' },
  { route: '/admin/bookings', label: 'Bookings', icon: '▦', permission: 'bookings:read' },
  { route: '/admin/users', label: 'Users & Passengers', icon: '◔', permission: 'users:read' },
  { route: '/admin/staff', label: 'Staff', icon: '☰', permission: 'staff:manage' },
  { route: '/admin/roles', label: 'Roles & Permissions', icon: '⚿', permission: 'roles:manage' },
  { route: '/admin/payments', label: 'Payments', icon: '€', permission: 'payments:read' },
  { route: '/admin/refunds', label: 'Refunds', icon: '↩', permission: 'payments:refund' },
  { route: '/admin/baggage', label: 'Baggage', icon: '◫', permission: 'baggage:manage' },
  { route: '/admin/checkin', label: 'Check-in', icon: '✓', permission: 'checkin:manage' },
  { route: '/admin/loyalty', label: 'Loyalty', icon: '★', permission: 'loyalty:manage' },
  { route: '/admin/notifications', label: 'Notifications', icon: '✉', permission: 'notifications:manage' },
  { route: '/admin/reports', label: 'Reports & Analytics', icon: '◨', permission: 'reports:read' },
  { route: '/admin/audit', label: 'Audit Log', icon: '≡', permission: 'audit:read' },
  { route: '/admin/settings', label: 'System Settings', icon: '⚙', permission: 'settings:manage' },
];
