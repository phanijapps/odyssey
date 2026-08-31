# RFC-0007: Adopt the cal.com-shaped package structure

- **Status:** Accepted
- **Date:** 2026-08-30
- **Owner approval:** in session ("go cal.com but cleanup the workspace
  nesting and docs")
- **Decision deck:** [`0007-notes/structure-deck.html`](0007-notes/structure-deck.html)
  (v2 — full-structure options, live-verified against cal.com, dub,
  twenty, and actualbudget via the GitHub API)

## Decision

Odyssey adopts the structure the deck calls **Option 1 — the cal.com
shape**, with the owner's two amendments:

1. **No `apps/` wrapper.** With exactly one application, the workspace is
   `web/ + packages/*` — every path drops one level.
2. **Runtime data at the repo root** (`data/`, git-ignored, actualbudget
   convention), resolved by walking up to the `pnpm-workspace.yaml`
   marker so any launch directory works. Environment overrides are
   unchanged.

Concretely:

- `apps/web/` → **`web/`**
- `apps/web/e2e/` → **`web/playwright/`** (cal.com and dub's placement)
- `apps/web/test/` → **`web/tests/`** (dub's placement)
- `apps/web/data/` → **`data/`** at the repo root
- `app/learner/` + the 948-line `app/page.tsx` → **`web/modules/practice/`**
  and **`web/modules/assessment/`** with thin route files
- `app/parent/`, `app/dashboard/` screens → **`modules/parent/`**,
  **`modules/admin/`** with thin route files
- Dead shadcn primitives (`components/ui/*`), `lib/`, `components.json`
  deleted

## Consequences

- The route tree answers "where is this screen" (`app/parent/page.tsx`)
  and `modules/` answers "what are its parts" — one question per folder.
- `apps/` may return without regret if a second application appears;
  the resolver and workspace list already support `apps/*`-style growth.
- All living documentation (README, architecture maps, AGENTS files,
  specs README, workspace queue) reflects this shape; historical records
  keep their original paths.

## Incident record (wave 1)

During the data-directory move, a failed `&&` chain was followed by an
`rm -rf` that deleted the live learning database (accounts and local
practice history). The curriculum store rebuilt automatically from the
reviewed seed on first open; the learning store recreated empty via
migrations. Recovery for accounts: the documented first-admin and
first-parent bootstrap environment variables. Captured as knowledge
entry K-0007: never `rm -rf` within reach of data directories.
