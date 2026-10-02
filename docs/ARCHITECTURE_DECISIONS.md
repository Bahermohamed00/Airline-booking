# Architecture Decisions

Append-only log of repo-level architectural decisions. For feature-level ADRs
see `docs/adr/`. Each entry records context, decision, and consequences.

---

## AD-2026-10-02-01 — Remove the unused `packages/shared` (`@airline/shared`)

**Status:** Accepted (implemented).

**Context.** `packages/shared` was scaffolded as a types package (`enums.ts`,
`dto.ts`, `index.ts`) and wired into the root `build`/`shared:build` scripts and
the `packages/*` workspace glob. Documentation described it as the shared
source of truth for domain enums and API DTO shapes.

**Evidence it was dead code (verified by repository search):**

- **Zero consumers.** No `import … from '@airline/shared'` anywhere in
  `apps/api` or `apps/web` source. The only references were the root build
  scripts and the lockfile.
- **No working alias.** The documented `apps/web/tsconfig.app.json` path alias
  to `packages/shared/src` did not exist in that file.
- **Duplicated Prisma enums.** Its `enums.ts` re-declared `CabinClass`,
  `BookingStatus`, `PaymentStatus`, etc. The API must use `@prisma/client`'s
  generated enums (the real source of truth), so a second copy was drift-prone.
- **Shapes didn't match reality.** `PaginatedResponse<T> = { data, meta }` does
  not match the actual wire shape the web already uses (`{ items, page, … }`);
  `ApiErrorResponse`/`JwtPayload` were not consumed either.
- **Wrong module format.** It built to CommonJS while `apps/api` is ESM
  (`"type": "module"`).
- `docs/PROJECT_OVERVIEW.md` already stated it was "currently not imported by
  either app."

**Decision.** **Delete** `packages/shared` rather than adopt it. Adopting would
have required inventing consumers and performing a broad, risky refactor for no
current behavioral need — both out of scope for the Foundation phase.

**Consequences.**

- Removed `packages/shared/` (source, `package.json`, `tsconfig`).
- Root `package.json`: dropped `shared:build`; `build` is now
  `api:build && web:build`. The `packages/*` workspace glob is **retained** so a
  future, justified shared package can be added without re-tooling.
- Regenerated `package-lock.json` (removed `@airline/shared`) so `npm ci` stays
  consistent.
- Updated `PROJECT_OVERVIEW.md`, `PROJECT_STRUCTURE.md`, `TRACEABILITY.md`,
  `BDocs.md` to remove/replace shared-package claims.
- Verified: `npm run build` (api + web) PASS, API unit 181/181 PASS, web unit
  378/378 PASS.

**Guidance.** Introduce a shared package only when both apps genuinely need the
identical type, and add it deliberately with an ADR. Until then, keep types
feature-local; `@prisma/client` remains the API's type source of truth.
