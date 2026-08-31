# Architecture Overview

> The living map of the monorepo. Read this first, then see
> [`application.md`](application.md) for the runtime, data flow, and route
> contracts. Historical decisions remain in [`../adr/`](../adr/) and
> [`../rfc/`](../rfc/); they are not descriptions of the running system.

## Layout

```text
.
├── AGENTS.md             # canonical contributor instructions
├── CLAUDE.md             # points to AGENTS.md
├── web/                  # the one deployable Next.js application
│   ├── app/              # thin routes: pages + App Router handlers
│   ├── modules/          # screens the cal.com way (practice, assessment,
│   │                     # parent, admin) — the unit of organization
│   ├── components/       # reusable browser components
│   ├── server/           # server-only policy and runtime modules
│   ├── playwright/       # Playwright end-to-end suite
│   └── tests/            # Vitest setup
├── data/                 # git-ignored runtime SQLite state (see its README)
├── packages/
│   └── practice-engine/  # pure question domain (bank, interactions,
│                         # adaptive pool with injected generation, grading)
├── README.md             # the project front door (quickstart, layout, config)
├── tools/hooks/          # repository hooks
├── docs/
│   ├── architecture/     # living implementation map
│   ├── adr/              # frozen decision records
│   ├── rfc/              # frozen proposal records
│   ├── specs/            # feature records and active plans
│   ├── product/          # living product state and release history
│   └── knowledge/        # curated engineering lessons
├── .agents/skills/       # project-owned agent workflows
├── .codex/               # reviewer definitions and hook configuration
└── workspace.toml        # work coordination
```

There is no `packages/` source boundary. The former curriculum package was
collapsed into the web app's `server/curriculum/` because it has one deployable
consumer.

## Runtime shape

One Next.js process serves browser pages and same-origin route handlers. Route
handlers validate their transport input, establish the caller's server-side
session scope where required, and call focused `src/server/` modules. Browser
code does not import those modules.

`@earendil-works/pi-ai` is used only by `src/server/pi-completion.ts` for
bounded, stateless text completion against the configured local OpenAI-compatible
Ollama endpoint. It has no tools, agent loop, filesystem access, database access,
or authorization authority. `pi-agent-core` and A2UI are not runtime
architecture boundaries; generated output is application data validated before
use, not agent-authored UI.

See [`application.md`](application.md#runtime-and-data-flow) for the full flow.

## Data ownership

- `web/server/persistence/sqlite.ts` is the sole owner of SQLite connection
  policy and ordered migrations. It opens the learning and curriculum stores
  under `app/data/` (git-ignored; see that directory's README).
- `web/server/learning/` owns formative practice state, attempts, and
  assessment records. Assessment results are retained separately from practice
  progression; history returns a redacted timeline.
- `web/server/curriculum/` owns the reviewed catalog: the versioned JSON seed
  (`data/ohio-catalog.json`), its idempotent hash-guarded seeder, Gold reads,
  and browse/search. There is no runtime ingestion workflow; catalog changes
  are reviewed code changes.
- `web/server/agent/` owns question selection (the adaptive pool over the
  reviewed bank) and the bounded Ollama completion/validation boundary used
  only as an optional internal fallback.

## Retention and erasure

- **Learner history — retained.** SQLite practice progression, redacted practice
  attempts, and terminal assessment records are retained locally. There is no
  automatic history purge, and no reset/export feature exists yet.
- **Active assessments — retained.** An active assessment is never selected for
  automatic deletion; it remains resumable until the learner explicitly reaches
  a terminal lifecycle state.
- **Authentication session state — short-lived.** A session row (including its
  plaintext generated-question pool and assignment token) is deleted
  opportunistically on authentication/session activity after 30 minutes idle or
  eight hours absolute age. This is request-driven cleanup, not a scheduled
  daemon.
- **Curriculum catalog — reproducible.** The reviewed catalog ships as
  versioned JSON in the repository; the seeder upserts it into the curriculum
  store at open. Deleting the curriculum database loses nothing that a fresh
  open cannot restore.

## Retrieval and generation

Browse and text search read the seeded curriculum tree.

Practice and assessment obtain a server-owned question from the reviewed bank.
When local generation is enabled, the adaptive pool supplies scoped standard
data to the Pi AI completion boundary, validates the structured result and
SVG, and otherwise falls back to a matching reviewed question or reports
unavailability. Generated content never touches curriculum records.

## Access and routes

Route handlers enforce the actual current session and same-origin mutation
checks. Learner practice and assessment reads are learner-scoped; their
mutations require the shared learner mutation proof. Curriculum administration
requires the admin role. Browse and search reads are currently open.
Parent-named routes require the parent role and are scoped to that parent's
active child links. The complete public route inventory is in
[`application.md`](application.md#public-route-contracts).

## Where to start

1. Read [`docs/CHARTER.md`](../CHARTER.md) for mission and scope.
2. Read this overview, [`reference.md`](reference.md), and
   [`application.md`](application.md).
3. Read the active feature's `spec.md` and `plan.md` in [`../specs/`](../specs/).
4. Follow the applicable nested `AGENTS.md` guidance before changing code.
