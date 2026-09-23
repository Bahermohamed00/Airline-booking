import { PrismaClient } from '@prisma/client';

export const prismaTestClient = new PrismaClient({
  datasources: {
    db: {
      url: process.env['DATABASE_URL'] ?? 'postgresql://airline:airline@localhost:5432/airline_booking_test?schema=public',
    },
  },
});

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const tables = [
    'audit_logs',
    'system_settings',
    'loyalty_transactions',
    'loyalty_accounts',
    'notifications',
    'notification_templates',
    'booking_extras',
    'extra_services',
    'boarding_passes',
    'check_ins',
    'baggage_events',
    'baggage',
    'booking_seats',
    'payments',
    'refunds',
    'booking_passengers',
    'passengers',
    'bookings',
    'fares',
    'flight_segments',
    'seat_holds',
    'flights',
    'routes',
    'seats',
    'aircraft',
    'airports',
    'role_permissions',
    'user_roles',
    'permissions',
    'roles',
    'users',
  ];

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
    } catch {
      // ignore missing tables
    }
  }
}
