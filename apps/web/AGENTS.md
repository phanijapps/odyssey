# apps/web — contributor guide

The one deployable Next.js application. Read the root `AGENTS.md` first;
this file carries only what's specific to this package.

## Layout

```text
app/            # routes: pages, browser UI, App Router handlers
components/     # shared browser components (server-safe imports only via types)
server/         # server-only modules — never imported from client components
lib/            # shared utilities (cn)
test/           # Vitest setup: per-file SQLite isolation + server-only stub
e2e/            # Playwright journeys (run: pnpm --filter child-math-app test:e2e)
data/           # git-ignored runtime state — see data/README.md
```

## Rules that bite

- `server/**` is importable only from server contexts. Client components
  may import **types only** from `@odyssey/practice-engine`; anything
  reaching a server module at runtime belongs in a route handler.
- Vitest gives every test file its own temporary SQLite pair
  (`test/sqlite-isolation.setup.ts`). Tests own their fixture rows; never
  rely on a local developer database. `ODYSSEY_SEED_CATALOG=0` keeps the
  catalog seeder out of exact-fixture tests.
- The e2e suite boots its own server with isolated databases under
  `data/e2e/`. One run per server boot — global-setup resets those files,
  so a second run against a live server splits inodes and fails with
  missing tables.
- Serve production only after `pnpm build`: `next start` serves the last
  build output, never the working tree.
- The generation boundary (`server/agent`) is the only code that talks to
  a model. It is injected into the practice engine as a
  `QuestionGenerator`; the engine itself never imports a client.
