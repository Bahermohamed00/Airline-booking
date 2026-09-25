import { SetMetadata } from '@nestjs/common';

export const OWNERSHIP_KEY = 'ownership';

export interface OwnershipRequirement {
  /** Registry key understood by OwnershipGuard (e.g. 'session'). */
  resource: string;
  /** Route param holding the resource id (e.g. 'id' for /sessions/:id). */
  param: string;
  /** Permission that bypasses the ownership check (super_admin always bypasses). */
  bypassPermission?: string;
}

/**
 * BR-12: customers may only touch their own resources. Stranger and missing
 * resources both answer 404 so existence is never leaked.
 */
export const CheckOwnership = (requirement: OwnershipRequirement) => SetMetadata(OWNERSHIP_KEY, requirement);
