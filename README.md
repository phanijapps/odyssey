# Odyssey Learning

A **local-first math practice application for grades 6–12**. A child signs
in, picks a skill, and works through one question at a time — with labeled
diagrams, hints, step-by-step solutions, and difficulty that adapts to
them. Parents see honest aggregate progress; an admin manages accounts,
the curriculum catalog, and system health. Everything runs on your own
machine with a SQLite database you own. No cloud account required.

Built with [Next.js](https://nextjs.org) (App Router, TypeScript) and
[@earendil-works/pi-ai](https://www.npmjs.com/package/@earendil-works/pi-ai)
as the optional local question-generation boundary.

## Quickstart

**Prerequisites:** Node.js ≥ 24.19 and [pnpm](https://pnpm.io) ≥ 10.

```bash
pnpm install          # one-time setup
pnpm dev              # develop at http://localhost:3000
```

For local development you can enable fixture accounts (`devadmin/admin`,
`devparent/parent`, `devstu/stu`) by copying `app/.env.example` to
`app/.env.local` and setting `ODYSSEY_ENABLE_DEVELOPMENT_FIXTURE_ACCOUNTS=1`.

For a production build:

```bash
pnpm build            # produce the Next.js application
pnpm start            # serve it (set ODYSSEY_APP_ORIGIN, see below)
```

### Optional: local question generation

The app runs entirely on its reviewed question bank. To also generate
fresh questions with a local [Ollama](https://ollama.com)-compatible
endpoint, set `PI_PROVIDER=ollama`, `PI_MODEL=<model>`, and
`OLLAMA_INTEGRATION=1` in `app/.env.local`. Every generated question,
answer, and diagram is validated against a strict schema before a child
ever sees it; on any failure the app falls back to the reviewed bank.

## Scripts

| Command                                 | What it does                      |
| --------------------------------------- | --------------------------------- |
| `pnpm install`                          | Install workspace dependencies    |
| `pnpm dev`                              | Run the app in development        |
| `pnpm build`                            | Production build                  |
| `pnpm start`                            | Serve the production build        |
| `pnpm test`                             | Deterministic test suite (Vitest) |
| `pnpm --filter child-math-app test:e2e` | Playwright end-to-end suite       |
| `pnpm typecheck`                        | TypeScript checks                 |
| `pnpm lint`                             | Formatting check (Prettier)       |

## The three personas

| Persona     | Route        | What they do                                                                                                                                                                                   |
| ----------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Student** | `/`          | Sign in → pick a skill → practice one question at a time (adaptive difficulty, hints, worked solutions, diagrams) or take a mixed-skill test; see their performance and next-practice guidance |
| **Parent**  | `/parent`    | Aggregate progress per child, suggest practice, create child accounts, reset passwords, revoke access — aggregates only, never raw answers                                                     |
| **Admin**   | `/dashboard` | Manage parent accounts; browse the reviewed curriculum catalog and its coverage                                                                                                                |

## Repository layout

```text
.
├── app/                      # the one deployable Next.js application
│   ├── src/app/              #   pages, browser UI, App Router handlers
│   ├── src/components/       #   reusable browser components
│   ├── src/server/           #   server-only modules (identity, learning,
│   │                         #   curriculum, agent, persistence, validation)
│   ├── data/                 #   git-ignored runtime SQLite state (+ backups/)
│   ├── e2e/                  #   Playwright end-to-end suite
│   └── .env.example          #   configuration template
├── packages/
│   └── practice-engine/      # pure question domain: reviewed bank, learner
│                             # interactions, adaptive pool (generation
│                             # injected), grading — no app imports
├── docs/                     # living documentation
│   ├── architecture/     #   the map of what runs today (start here)
│   ├── adr/              #   frozen architecture decision records
│   ├── rfc/              #   governance proposals (open → closed)
│   ├── specs/            #   feature contracts and build plans
│   ├── product/          #   briefs, roadmap, changelog
│   └── knowledge/        #   curated engineering lessons
├── tools/hooks/          # repository hooks
├── workspace.toml        # work coordination queue
└── AGENTS.md             # canonical contributor instructions
```

## Data and persistence

All runtime state lives in **`app/data/`** (git-ignored):

- `odyssey-learning.db` — accounts, sessions, practice progress,
  attempts, assessments, parent↔child links. **This is the file that
  matters** — back it up to preserve a learner's history.
- `odyssey-curriculum.db` — the reviewed topic catalog, seeded
  idempotently at first open from the versioned JSON in
  `app/src/server/curriculum/data/`.

Both databases open in WAL mode with foreign keys enforced and ordered,
append-only migrations. Override their locations with `ODYSSEY_DB_PATH`
and `ODYSSEY_CURRICULUM_DB_PATH` (absolute paths). The admin console's
Health panel writes consistent snapshots of the learning database into
`app/data/backups/` with one click; parents can export any linked
child's progress as JSON from the parent portal.

## Configuration

All configuration is environment-based; see [`app/.env.example`](app/.env.example)
for the full annotated template. The essentials:

| Variable                                                                                                                                   | Purpose                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `ODYSSEY_APP_ORIGIN`                                                                                                                       | **Required in production** — the exact public origin used for same-origin mutation checks |
| `ODYSSEY_DB_PATH` / `ODYSSEY_CURRICULUM_DB_PATH`                                                                                           | Absolute database locations (default: `app/data/`)                                        |
| `ODYSSEY_SEED_CATALOG`                                                                                                                     | Set `0` to skip seeding the reviewed catalog (tests with exact fixtures)                  |
| `ODYSSEY_ENABLE_DEVELOPMENT_FIXTURE_ACCOUNTS`                                                                                              | Dev-only fixture sign-ins                                                                 |
| `ODYSSEY_ENABLE_LOCAL_PARENT_BOOTSTRAP` / `ODYSSEY_ENABLE_PRODUCTION_PARENT_BOOTSTRAP` + `ODYSSEY_PARENT_BOOTSTRAP_USERNAME` / `_PASSWORD` | One-time first-parent creation while no parent exists                                     |
| `ODYSSEY_ENABLE_LOCAL_ADMIN_BOOTSTRAP` / `ODYSSEY_ENABLE_PRODUCTION_ADMIN_BOOTSTRAP` + `ODYSSEY_ADMIN_BOOTSTRAP_USERNAME` / `_PASSWORD`    | One-time first-admin creation while no admin exists                                       |
| `PI_PROVIDER`, `PI_MODEL`, `OLLAMA_INTEGRATION`                                                                                            | Optional local question generation                                                        |

## Architecture

The runtime is one Next.js process: browser pages and same-origin route
handlers, validated at the boundary, calling focused `src/server/`
modules over SQLite. The agent boundary is deliberately narrow — it can
propose a question, never persist, authorize, or execute anything.

Start with [`docs/architecture/overview.md`](docs/architecture/overview.md),
then [`docs/architecture/application.md`](docs/architecture/application.md)
for route contracts. Historical reasoning lives in
[`docs/adr/`](docs/adr/) and [`docs/rfc/`](docs/rfc/).

## Testing

```bash
pnpm test                                  # 190+ deterministic tests
pnpm --filter child-math-app test:e2e      # browser end-to-end suite
```

Integration tests that call a real model endpoint are skipped unless
`OLLAMA_INTEGRATION=1` is set.

## Contributing

This repository is agent-friendly and convention-driven: read
[`AGENTS.md`](AGENTS.md) first, then [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md).
Non-trivial changes follow the `work-loop` skill (spec → gates → review);
commits follow Conventional Commits.
