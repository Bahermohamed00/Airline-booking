# Authorization resolved from the database per request

Roles and Permissions are NOT embedded in access-token claims. `JwtStrategy.validate()` reloads the User with its roles, permissions, and (via the `sid` claim) Session validity from PostgreSQL on every authenticated request, so logout, session revocation, and permission changes take effect immediately rather than at token expiry.

## Considered Options

- Embedding roles/permissions in the JWT: fewer queries, but staff permission changes and session revocation would lag by up to the 15-minute token TTL — rejected because SRS §6 requires backend-enforced least privilege.

## Consequences

- One primary-key-indexed query per authenticated request; revisit with a short-TTL cache only if profiling shows need.
- Access tokens stay small; `super_admin` is derived from `Role.isSuperAdmin`, never from client input.
