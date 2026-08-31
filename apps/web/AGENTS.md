# web — contributor guide

The one deployable Next.js application, organized the cal.com way.
Read the root `AGENTS.md` first; this file carries only what's specific
to this package.

## Layout

```text
app/            # thin Next routes — each page composes one module screen
modules/        # the unit of organization (cal.com's word):
  practice/       # student screen: sign-in, grade pick, skill browse,
  │               # question+feedback flow, performance view
  assessment/     # test mode: setup, runner, results
  parent/         # parent portal screen + phrase helpers
  admin/          # admin console screen (overview, catalog, parents, health)
components/      # cross-screen shared components (interaction-answer, math-text)
server/          # server-only domain modules
tests/           # Vitest setup: per-file SQLite isolation + server-only stub
playwright/      # e2e journeys + shared DB-path helper
```

## Rules that bite

- `modules/<name>` owns a screen's parts. A module may import
  `server/`, `components/`, and `packages/practice-engine` — **never
  another module's internals**.
- `server/**` is importable only from server contexts. Client components
  may import **types only** from `@odyssey/practice-engine`.
- Routes in `app/` stay thin (compose one screen); HTTP handlers in
  `app/api/` stay thin adapters over `server/`.
- Vitest gives every test file its own temporary SQLite pair
  (`tests/sqlite-isolation.setup.ts`); tests own their fixture rows.
  `ODYSSEY_SEED_CATALOG=0` keeps the catalog seeder out of exact-fixture
  tests.
- Runtime state lives in the **repo-root** `data/` directory (git-ignored),
  resolved via the `pnpm-workspace.yaml` marker walk — see
  `server/persistence/sqlite.ts` and `playwright/paths.ts`.
- The e2e suite boots its own server with isolated databases under
  `data/e2e/`. One run per server boot; always `pnpm build` before
  `pnpm start`-based verification.
- The generation boundary (`server/agent`) is the only code that talks
  to a model, injected into the practice engine as a `QuestionGenerator`.
