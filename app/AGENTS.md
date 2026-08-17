# App contributor guide

`app/` is the single Next.js deployable. Run its checks with:

```bash
pnpm --dir app test
pnpm --dir app typecheck
pnpm --dir app build
```

## Boundaries

- Keep browser components under `src/app/` and `src/components/`; server code is
  under `src/server/` or route handlers and must retain `server-only` boundaries.
- Derive learner identity from the server-owned session. Validate route input and
  generated payloads before persistence or rendering.
- SQLite owns local state. Keep test, practice, identity, curriculum, and agent
  responsibilities in their focused server modules; do not create a second service.
- Pi and native integrations stay server-only, bounded, and without authority to
  write arbitrary records or choose authorization.
- Reuse an abstraction only after two callers need the same policy. Preserve
  transaction and learner-scope checks when consolidating data access.
- Vitest creates an isolated temporary learning and curriculum database for each
  test file. Every test owns the fixture rows it needs; never rely on a local
  developer database or another test file's state.
- A2UI delivery is pinned to `@a2ui/react@0.9.1` and
  `@a2ui/web_core@0.9.2`; `zod@3.25.76` is a direct peer dependency. Use only
  the v0.9 entrypoints and the Odyssey allowlist—never a model-issued catalog.
- `@playwright/test` is the browser smoke/visual-QA dev dependency. Keep browser
  scenarios focused on authenticated user journeys and run `pnpm --dir app test:e2e`
  against its isolated local database; it does not ship in the application runtime.

Read `../AGENTS.md` and `../docs/architecture/reference.md` before structural
or security-sensitive changes.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
