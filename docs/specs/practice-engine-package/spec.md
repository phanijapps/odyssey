# Final stretch — practice-engine package + production readiness

**Status:** Shipped
**Mode:** full (structural: new workspace package; security: bootstrap/backup routes)
**Contract of record:** owner directive 2026-08-30 ("go till the win; not happy with package organization"); RFC-0006 phases 6-lite + 8.

## Objective

1. **`packages/practice-engine`** — extract the pure question domain into a
   real workspace package (the professional-organization ask): question
   bank, learner question interactions, the adaptive pool (with the
   generation boundary **injected**, not imported), and grading. The
   package has no app imports, no `server-only`, no side effects —
   client-safe and server-safe. The app keeps the generation boundary
   (`agent/`) and owns a thin generator adapter.
2. **Phase 8 production readiness** — production admin bootstrap
   (env-gated, zero-admins guard, mirroring the parent bootstrap);
   `/api/admin/health` (schema version, catalog count, generator status);
   `/api/admin/backup` (admin-proof `VACUUM INTO` of the learning DB into
   `app/data/backups/`); parent-side child-progress export (JSON of the
   parent-safe projection); admin console gains a Health panel with the
   one-tap backup.
3. **Deferred with rationale** (backlog): full student-surface redesign
   per mockups (works + e2e-covered today; visual polish is its own
   pass), single-DB merge (two files in one git-ignored dir already meet
   the bar; merge is data-migration risk without user value).

## Acceptance criteria

- [x] AC1: `packages/practice-engine` exists as a pnpm workspace package
      (`@odyssey/practice-engine`) exporting the bank, interactions, pool,
      and grading; its modules import nothing from `app/`; its tests run in
      the workspace test suite; app-wide imports updated; `server/` root has
      no loose files (pi-completion/ollama-openai-url move into `agent/`).
- [x] AC2: Adaptive-pool behavior is unchanged (generation attempts,
      dedupe, bank fallback) with the generator injected; unit tests cover
      the injected-generator path (generate → pool question; generator
      failure → bank fallback).
- [x] AC3: Production admin bootstrap seeds a first admin while none
      exists (env-gated, dev + prod flags); tests cover the zero-admins
      guard and refusal when an admin exists.
- [x] AC4: `/api/admin/health` returns schema version, catalog record
      count, generator configured flag (admin read, no-store);
      `/api/admin/backup` writes a timestamped `VACUUM INTO` snapshot of the
      learning DB under `app/data/backups/` (admin mutation proof; refuses
      existing filenames; gitignored); admin console Health panel shows
      status and performs the backup.
- [x] AC5: Parent export endpoint returns the parent-safe progress JSON
      for a linked child (parent read + active link recheck); parent page
      links it as a download.
- [x] AC6: Gates green (typecheck, full suite incl. package tests, lint);
      e2e 6/6 on a fresh build; README + app/.env.example document the new
      env vars and package layout.

## Testing strategy

- TDD: injected-generator pool tests, admin-bootstrap tests, backup
  route tests (success, wrong role, filename collision), health test,
  export test (linked child, unlinked child → 403).
- Manual QA: fresh production boot with admin bootstrap env → admin
  sign-in → health panel → backup button → file appears under
  `app/data/backups/`; parent export downloads JSON.

## Assumptions

- Backup covers the learning DB only — the curriculum store is
  reproducible from the reviewed seed (documented in UI copy).
- Package ships TypeScript source directly (exports → src, Next
  `transpilePackages`); no build step in the package.

## Manual QA evidence (recorded 2026-08-30)

Fresh production instance with both bootstraps on custom data paths:

- `firstadmin` signed in (200) via the production admin bootstrap
  (zero-admins guard; env-gated) on a database with no prior admin.
- `/api/admin/health` → `{"schemaVersion":12,"catalogRecords":728,
"generatorConfigured":false}` — the seeder filled the fresh curriculum
  store at its custom path; generator honestly reports off.
- `/api/admin/backup` → `{"ok":true,"file":"learning-20260830-224737.db"}`
  under the instance's `backups/` directory; the snapshot contains the
  seeded accounts (restorable copy verified by direct sqlite query).
- Parent created a child (201); `/api/parent/children/:id/export`
  returned `attachment; filename="odyssey-smokedaughter-progress.json"`
  with the parent-safe aggregate body.
- Anonymous/learner/wrong-origin probes on health + backup all 403.
- Gates: typecheck, 15 package tests + 193 app tests, lint; e2e 6/6 on a
  fresh production build (package transpiled via next.config.ts).
