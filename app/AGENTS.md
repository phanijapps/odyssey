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

Read `../AGENTS.md` and `../docs/architecture/reference.md` before structural
or security-sensitive changes.
