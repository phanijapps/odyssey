# Parent management — implementation plan

- **Status:** Done
- **Spec:** [spec.md](spec.md)

## Tasks

### T1: Spec + plan docs (this document)

### T2: Learner scope-key helper

**Status:** Complete — helper exported and used at sign-in and both parent aggregation routes.

`identity.ts` exports `learnerScopeKeyForUsername(username)` —
fixture childId when the username is a seeded fixture, else
`child:<username>`. The sign-in derivation calls it so sign-in and the
parent routes cannot drift.

### T3: Admin parent lifecycle in identity

**Status:** Complete — list/create/reset with role enforcement and session invalidation; PATCH added to the admin mutation proof.

`listParentAccounts`, `createParentAccount`, `resetParentAccountPassword`
(password reset also deletes that username's sessions, one transaction).
`validateChildCredentials` parameterized into
`validateAccountCredentials(credentials, label)`. `requireAdminMutationProof`
accepts PATCH.

### T4: Admin API routes + tests

**Status:** Complete — 3 test cases covering guards, body shape, no-store, reset invalidation, duplicate and wrong-role failures; verified live over HTTP.

`api/admin/parents/route.ts` (GET list with children usernames, POST
create) and `api/admin/parents/[parentId]/route.ts` (PATCH reset).
Tests mirror `api/parent/children` route tests.

### T5: Performance + preview scope-key fix

**Status:** Complete — masked test seeding rewritten as the regression; live parent-of-created-child journey returns the redacted document.

Parent performance and preview aggregate by
`learnerScopeKeyForUsername(child.username)`; the masked test seeding is
rewritten as the regression test.

### T6: Dashboard Parents tab

**Status:** Complete — parents nav item with badge, create + reset forms on existing style families.

`dashboard/page.tsx`: `parents` nav item, list + create + reset
interaction, existing style families only.

### T7: Admin landing

**Status:** Complete — admin role routes to /dashboard on fresh sign-in and session restore.

`page.tsx` routes `role === "admin"` to `/dashboard` on fresh sign-in and
session restore.

### T8: devparent fixture + seed order

**Status:** Complete — devparent/parent fixture; bootstrap seeds before fixtures, pinned by parent-fixture-seed-order.test.ts.

`DEVELOPMENT_FIXTURE_ACCOUNTS` gains `devparent` / `parent` (childId `""`,
matching the bootstrap parent session shape). `seedAccounts()` runs the
env bootstrap before fixtures so explicit credentials win.

### T9: Records + commits

Changelog, spec closure, adversarial + security review, per-area commits.

## Journal

- 2026-08-18: Drafted from the maintainer request and the approved plan.
- 2026-08-18: Shipped — all tasks complete, gates green, live HTTP journey verified.
