# Repo professionalization — data directory, README, env template

**Status:** Shipped
**Mode:** light (no new module boundary; path defaults + docs + gitignore discipline)
**Contract of record:** owner directive 2026-08-30 ("professional open-source project" organization; data in its own gitignored directory), continuing RFC-0006.

## Objective

Give the repository the front door and runtime-state discipline of a
maintained OSS TypeScript app (cal.com-style conventions): one gitignored
`app/data/` directory owning all SQLite state, a root README with
quickstart/scripts/layout/env reference, and the env template moved to
`app/.env.example` (where Next.js consumes it).

## Acceptance criteria

- [x] AC1: All runtime SQLite state lives under `app/data/` — learning and
      curriculum DBs by default, e2e DBs under `app/data/e2e/`; the directory's
      contents are gitignored (`git check-ignore` proves it) while
      `app/data/README.md` and `.gitkeep` remain committable; existing live DBs
      are physically moved (accounts survive — proven by sign-in smoke).
- [x] AC2: Stale state is gone: root-level `odyssey-*.db` leftovers,
      `app/odyssey-knowledge-graph.db` (dead module), `.fastembed_cache/`
      (dead dependency) deleted.
- [x] AC3: Root `README.md` exists with: what/why, quickstart, scripts,
      repository layout, personas, data/persistence section, configuration
      reference (post-simplification env surface), architecture pointers,
      testing, contributing pointer.
- [x] AC4: `.env.example` lives at `app/` with the current env surface
      (no Engram keys; documents data-dir defaults); docs/architecture and
      AGENTS layout trees mention `app/data/`.
- [x] AC5: Gates green; e2e 6/6 against a fresh production build using the
      new data paths.

## Testing strategy

- Existing suite (sqlite path resolution + isolation setup unchanged in
  behavior: they pin absolute env paths).
- `git check-ignore` proofs for data files; `git status` shows only
  intended committables.
- Sign-in smoke on the moved learning DB (accounts survived the move);
  e2e on fresh build (rebuild-first lesson enforced).

## Assumptions

- Package-scoped `app/data/` (not repo-root `data/`) — cwd-relative
  defaults stay robust for every supported launch mode, and each app in a
  monorepo owns its state.
- No LICENSE file is added: licensing is an owner decision, not an
  agent's.
