import { pathToFileURL } from 'node:url';
import { prisma } from './seed/shared.js';
import { seedIdentity } from './seed/identity.seed.js';
import { seedCatalog } from './seed/catalog.seed.js';
import { seedFlights } from './seed/flights.seed.js';
import { seedBookings } from './seed/booking.seed.js';
import { seedOffers } from './seed/offers.seed.js';
import { seedOperations } from './seed/operations.seed.js';

// Re-export the public constants/helpers that tests and other tooling import
// from `prisma/seed` — the split into prisma/seed/* must not break those consumers.
export { AIRLINE_CODE, seededFlightNumbers, generateLoyaltyMemberNumber } from './seed/shared.js';
export { AIRCRAFT_DEFS, AIRPORTS } from './seed/catalog.seed.js';
export { SCHEDULE_RULE_DEFS } from './seed/flights.seed.js';

/**
 * Root seed orchestrator. Runs the domain seeds in dependency order:
 *   identity → catalog → flights → booking → offers → operations
 * (identity gives users/roles; catalog gives airports/aircraft/routes; flights
 * needs catalog; booking needs flights + the customer; offers/operations are
 * independent). Behavior and console output are unchanged from the single-file
 * seed; only the internal organization changed.
 */
async function main(): Promise<void> {
  const { permissions, roles, admin, customer } = await seedIdentity();
  const { airports, aircraft, routes } = await seedCatalog();
  const { scheduleRules, adopted } = await seedFlights(routes, aircraft, airports);
  await seedBookings(customer);
  const offers = await seedOffers();
  await seedOperations(customer);

  // eslint-disable-next-line no-console
  console.log(
    `Seeded: ${permissions.length} permissions, ${roles.length} roles, ${airports.length} airports, ${aircraft.length} aircraft, ${routes.length} routes, ${scheduleRules.length} schedule rules (${adopted} flights adopted), ${offers} offers`,
  );
  // eslint-disable-next-line no-console
  console.log(`Users: admin=${admin.email} / customer=${customer.email}`);
}

// Only run when executed directly (e.g. `tsx prisma/seed.ts`); importing this
// file for its constants/helpers must not touch the database.
const isDirectRun = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      // eslint-disable-next-line no-console
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
