<!--
Thanks for the PR! Keep it small and focused — one independently mergeable
concern (target ≤ 400 lines / ≤ 10 files; see docs/GIT_WORKFLOW.md).
Delete any section that does not apply.
-->

## Summary

<!-- What does this change and why? Link the issue if there is one. -->

## Module

<!-- e.g. bookings, payments, offers, notifications, extras (Dev A) ·
     auth, users, catalog, flights, check-in, baggage, loyalty, dashboard,
     audit, settings, platform (Dev B) -->

## Type of Change

- [ ] Feature
- [ ] Bug Fix
- [ ] Refactor
- [ ] Database
- [ ] Documentation
- [ ] CI/Infrastructure

## Files/Areas Changed

<!-- High-level list of the main files/areas touched. -->

## Database Changes

- [ ] No DB change
- [ ] Prisma schema (`prisma/schema/<Model>/`)
- [ ] Migration (one logical migration, domain-oriented name)
- [ ] Seed (`prisma/seed/`)

<!-- If you changed the schema or added a migration, confirm you followed
     docs/PRISMA_OWNERSHIP.md (rebased onto latest main migrations first). -->

## Testing

- [ ] Unit tests
- [ ] E2E tests
- [ ] API build
- [ ] Web build

## Ownership

- [ ] I am the module owner (per `.github/CODEOWNERS`)
- [ ] The module owner reviewed the change

## Cross-module Changes

<!-- Describe any cross-module dependency. Cross-module reads should use an
     exported service; cross-module writes are avoided except the documented
     payment-lifecycle exception (see docs/ARCHITECTURE_RULES.md). -->

## Risks

<!-- Anything reviewers should watch: migrations, breaking changes, rollbacks. -->

## Checklist

- [ ] No secrets
- [ ] No unrelated changes
- [ ] Tests pass
- [ ] Build passes
- [ ] Documentation updated (`PROJECT_OVERVIEW.md` / `TRACEABILITY.md` when applicable)
