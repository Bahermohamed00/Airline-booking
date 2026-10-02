# Git Workflow

How NovaAir's two developers branch, review, and merge. Companion docs:
`docs/PRISMA_OWNERSHIP.md` (schema ownership + migration rules),
`docs/ARCHITECTURE_RULES.md` (code boundaries), `.github/CODEOWNERS` (review
routing), `.github/workflows/ci.yml` (required checks).

- **Developer A — Customer & Revenue**
- **Developer B — Operations & Platform**

---

## 1. `main`

`main` is the single source of truth and is **protected**:

- **No direct pushes.**
- **Pull request required** for every change.
- **CI required** — the `ci` workflow must be green.
- **Review required** — the owning developer (per CODEOWNERS) must approve.

## 2. Branch naming

Create branches from an up-to-date `main`.

**Features:**

```text
feature/<module>-<short-description>
```

```text
feature/notifications-module
feature/booking-extras-api
feature/offers-home-wiring
feature/checkin-boarding-pass
feature/admin-users-real-api
```

**Chores:**

```text
chore/ci-pipeline
chore/split-prisma-seed
chore/stabilize-repository
```

**Refactors:**

```text
refactor/split-angular-routes
refactor/shared-contracts
```

**Bug fixes:** `fix/<module>-<short-description>`.

## 3. Branch lifetime

- Keep branches **short-lived — preferably ≤ 3 working days.**
- Prefer **small PRs** over long-running ones.
- **No month-long feature branches.**

A "module" is **not** necessarily one branch. Split a module into small,
independently mergeable slices:

```text
BAD :  feature/booking                      (open for two weeks)

GOOD:  feature/booking-admin-cancel-ui
       feature/booking-seat-hold-validation
       feature/booking-extras-api
```

## 4. Merge workflow

```text
main
 ↓
create feature branch
 ↓
implement a small change
 ↓
tests (unit + e2e as applicable)
 ↓
push
 ↓
Pull Request
 ↓
review (CODEOWNERS routes to the owner)
 ↓
CI green
 ↓
squash merge
 ↓
delete branch
```

**Merge strategy: squash merge.** Each PR lands on `main` as one clean commit;
the PR title becomes the commit subject (keep it in
`type(scope): description` form, e.g. `feat(bookings): add cancel-reason`).

### Keeping your branch up to date

Rebase your own branch on `main` **before opening the PR**:

```bash
git fetch origin
git rebase origin/main
```

If you prefer not to rewrite history, merging `main` into your branch is also
acceptable before the PR is opened:

```bash
git fetch origin
git merge origin/main
```

**Team policy:** rebase (or merge `main` in) freely *before* the PR is opened.
Once **review has started**, avoid force-pushing — push ordinary follow-up
commits so reviewers can see what changed; the squash merge keeps `main` clean.

### Prisma branches

If your PR includes a migration, follow `docs/PRISMA_OWNERSHIP.md`: rebase onto
the latest `main` migrations **before** generating yours; if `main` gained
migrations after you branched, rebase → `npm run db:reset` → replay → regenerate
your migration. One logical migration per PR.

## 5. Merge conditions

A PR may merge only when **all** of these hold:

- CI green (build + unit + e2e + Prisma validate/generate + migration guard + lint).
- Tests green.
- Build green (API + web).
- Reviewer approved (the module owner, via CODEOWNERS).
- No unresolved review comments.
- No accidental unrelated changes.
- Documentation updated when applicable (`PROJECT_OVERVIEW.md`, `TRACEABILITY.md`).
- Migrations validated (migration guard passes; naming follows the convention).
- No secrets.
- No generated artifacts accidentally committed (`dist/`, `node_modules/`,
  Prisma client, coverage).

## 6. PR size guidelines

Preferred PR: **one independently mergeable concern.**

Targets (guidelines, **not** hard limits):

```text
≤ 400 changed lines
≤ 10 files
```

- If a change naturally exceeds these, **split it where practical.**
- **Do not artificially split tightly coupled atomic changes** — a migration and
  its schema change belong together; a route and its guard belong together.
- Large efforts land as a sequence of small PRs (see "Branch lifetime"), not one
  giant PR.
