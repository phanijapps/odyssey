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
├── app/                  # the one deployable Next.js application
│   ├── src/
│   │   ├── app/          # pages, browser UI, and App Router handlers
│   │   ├── components/   # reusable browser components
│   │   └── server/       # server-only policy and runtime modules
│   ├── data/             # git-ignored runtime SQLite state (see its README)
│   └── e2e/              # Playwright end-to-end suite
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
collapsed into `app/src/server/curriculum/` because it has one deployable
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

- `src/server/persistence/sqlite.ts` is the sole owner of SQLite connection
  policy and ordered migrations. It opens the learning and curriculum stores;
  promotion state shares the curriculum store.
- `src/server/learning/` owns formative practice state, attempts, and
  assessment records. Assessment results are retained separately from practice
  progression; history returns a redacted timeline.
- `src/server/curriculum/` owns the reviewed catalog, Bronze → Silver → Gold
  workflow, Gold queries, and local vector index.
- `src/server/memory/` owns optional native profile-memory and knowledge-graph
  projections. They receive only derived learning signals and do not replace
  SQLite as the authoritative learning store.

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
- **Curriculum workflow artifacts — temporary.** Bronze, Silver, and pending
  Gold handoff data expire after 24 hours and are purged on the next workflow
  operation; the artifacts are also deleted immediately after successful Gold
  finalization. Approved Gold records are not in this temporary class.
- **Derived projections — disposable.** Native profile-memory, knowledge-graph,
  and local vector data are non-authoritative projections. They may be lost or
  rebuilt from SQLite learning records and reviewed Gold data where their
  current adapters support rebuilding; no automatic deletion or user reset is
  introduced by this policy.

## Retrieval and generation

Browse and ordinary search read the reviewed curriculum tree. Semantic search
embeds a query locally, asks the local SQLite vector projection for bounded
nearest records, and falls back to text ranking when that projection is
unavailable. The graph is a separate optional projection; it is not a retrieval
or reranking stage.

Practice and assessment obtain a server-owned question from the reviewed bank
when available. When local generation is enabled, the server supplies scoped
standard data to the Pi AI completion boundary, validates the structured result
and SVG, and otherwise falls back to a matching reviewed question or reports
unavailability. Generated content never promotes curriculum records.

## Access and routes

Route handlers enforce the actual current session and same-origin mutation
checks. Learner practice and assessment reads are learner-scoped; their
mutations require the shared learner mutation proof. Curriculum administration
requires the admin role. Browse, topic, search, and memory-availability reads
are currently open. Parent-named routes are scoped to whichever signed-in
session calls them; the implementation does not currently define a separate
parent role. The complete public route inventory is in
[`application.md`](application.md#public-route-contracts).

## Where to start

1. Read [`docs/CHARTER.md`](../CHARTER.md) for mission and scope.
2. Read this overview, [`reference.md`](reference.md), and
   [`application.md`](application.md).
3. Read the active feature's `spec.md` and `plan.md` in [`../specs/`](../specs/).
4. Follow the applicable nested `AGENTS.md` guidance before changing code.
