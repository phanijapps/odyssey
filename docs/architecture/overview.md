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
├── webapp/               # the one deployable Next.js application
│   ├── app/              # pages and App Router handlers
│   ├── modules/          # practice, assessment, parent, admin screens
│   ├── components/       # reusable browser components
│   ├── server/           # identity and learning orchestration
│   ├── playwright/       # end-to-end suite
│   └── tests/            # Vitest setup
├── packages/
│   ├── core/             # pure learning domain (algorithms, curriculum,
│   │                     # validators) — absorbs the former practice-engine
│   ├── db/               # node:sqlite client, ordered migrations,
│   │                     # learning + curriculum repositories
│   ├── ai/               # bounded generation boundary: providers,
│   │                     # versioned prompts, generator adapter
│   └── config/           # shared TypeScript base
├── data/                 # git-ignored runtime SQLite state (see its README)
├── tooling/              # dev hooks + shared Vitest preset
├── .github/              # CI workflows (quality + e2e) and CODEOWNERS
├── README.md             # the project front door (quickstart, layout, config)
├── docs/
│   ├── architecture/     # living implementation map
│   ├── adr/              # frozen decision records
│   ├── rfc/              # frozen proposal records
│   ├── specs/            # feature records and active plans
│   ├── product/          # living product state and release history
│   └── knowledge/        # curated engineering lessons
├── .agents/skills/       # project-owned agent workflows
├── .codex/               # reviewer definitions and hook configuration
└── .agents/workspace.toml        # work coordination
```

The workspace manifest includes `webapp` and `packages/*`. Shared core, database,
and AI code have explicit package exports; web-owned orchestration remains in
`webapp/server/`.

## Runtime shape

One Next.js process serves browser pages and same-origin route handlers. Route
handlers validate their transport input, establish the caller's server-side
session scope where required, and call focused `webapp/server/` modules. Browser
code does not import those modules.

`packages/ai/src/providers/pi-completion.ts` uses `@earendil-works/pi-ai` for
bounded, stateless text completion against the configured local OpenAI-compatible
Ollama endpoint. It has no tools, agent loop, filesystem access, database access,
or authorization authority. `pi-agent-core` and A2UI are not runtime
architecture boundaries; generated output is application data validated before
use, not agent-authored UI.

See [`application.md`](application.md#runtime-and-data-flow) for the full flow.

## Data ownership

- `packages/db/src/client.ts` is the sole owner of SQLite connection
  policy and ordered migrations. It opens the learning and curriculum stores
  under repo-root `data/` (git-ignored; see that directory's README).
- `webapp/server/learning/` owns practice orchestration, attempts and assessment
  lifecycle. `packages/db/src/repositories/learning.ts` owns persistence;
  assessment results remain separate from practice progression.
- `packages/core/src/curriculum/data/ohio-catalog.json` is the reviewed catalog
  source. `packages/db/src/catalog-seed.ts` seeds it idempotently;
  `packages/db/src/repositories/` owns Gold reads and browse/search.
- `packages/core/src/algorithms/` owns reviewed-bank selection, atlas walking and
  grading. `packages/ai/src/` owns optional bounded generation and validation.
- `webapp/server/identity/identity.ts` owns the session pool, generation identity,
  walk state and active assignment. The progress route conditionally claims and
  updates that state; the learning service consumes answers transactionally.

## Retention and erasure

- **Learner history — retained.** SQLite practice progression, redacted practice
  attempts, and terminal assessment records are retained locally. There is no
  automatic history purge or reset feature. Parents can export linked-child
  progress through the parent portal.
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

Practice begins with a matching reviewed-bank question when available. For one
reviewed standard with generation enabled, the winning pool creation launches
one bounded background atlas request. Its prompt contains standard code and text,
never learner state. Accepted nodes cover at least two concepts and all tiers;
the walker starts at tier 1, deepens/widens after correct answers, and prefers
fresh siblings after incorrect answers. Generated prerequisite edges are absent.

Conditional session writes preserve the active question and accepted answers
when a batch arrives. Generation identity rejects late results after a skill
switch, restart or session end. Pending work expires after 240 seconds; ordinary
reads do not restart failed or completed batches. Explicit restart creates a new
round only once the current round is terminal and has no active assignment.
Answers never call a model. Assessments retain their separate preparation path.
Generated content never touches curriculum records.

## Access and routes

Route handlers enforce the actual current session and same-origin mutation
checks. Learner practice and assessment reads are learner-scoped; their
mutations require the shared learner mutation proof. Curriculum administration
requires the admin role. Browse and search reads are currently open.
Parent-named routes require the parent role and are scoped to that parent's
active child links. The core learning route contracts are in
[`application.md`](application.md#public-route-contracts).

## Where to start

1. Read [`docs/CHARTER.md`](../CHARTER.md) for mission and scope.
2. Read this overview, [`reference.md`](reference.md), and
   [`application.md`](application.md).
3. Read the active feature's `spec.md` and `plan.md` in [`../specs/`](../specs/).
4. Follow the applicable nested `AGENTS.md` guidance before changing code.
