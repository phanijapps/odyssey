# Application runtime and public route contracts

> **Living implementation reference.** This expands the overview with the
> actual runtime boundaries and route compatibility surface. It intentionally
> does not restate frozen ADR or RFC language.

## Runtime and data flow

```text
Browser UI
  → App Router page or route handler
  → input validation + session/role/origin check (when required)
  → focused server module
  → SQLite authority and optional projections
  → safe response projection
```

### Practice and assessment

1. A learner-scoped read obtains progress and claims a server-issued practice
   assignment, or reads/resumes an assessment.
2. A learner mutation proof binds an answer submission to that session. The
   learning module atomically consumes the assignment and persists the result.
3. Practice updates progression and a redacted attempt record. Assessment
   stores its own selected-record snapshot, prepared questions, and terminal or
   partial result; it does not update practice mastery.
4. History projects practice attempts and terminal assessments without raw
   submitted answers.

### Retention and cleanup

The local SQLite learning store retains progression, redacted practice attempts,
and terminal assessment history until a future user-driven reset/export contract
exists. Active assessments are resumable state and are never automatically
deleted.

Session cleanup is opportunistic: normal authentication/session activity removes
rows past the 30-minute idle or eight-hour absolute limit. Deleting that row also
removes its session-owned plaintext question pool and assignment token; there is
no scheduler or background daemon.

### Curriculum and retrieval

1. The curriculum source of record is the reviewed, versioned JSON catalog
   (`server/curriculum/data/ohio-catalog.json`). An idempotent, hash-guarded
   seeder upserts it into `gold_curriculum_records` on curriculum-database
   open; `ODYSSEY_SEED_CATALOG=0` disables seeding for exact-fixture tests.
2. Browse and text search read the seeded Gold store. There is no runtime
   ingestion workflow; catalog changes are reviewed code changes.

### Pi AI completion boundary

`src/server/pi-completion.ts` configures `@earendil-works/pi-ai` for one
stateless, text-only completion against a local OpenAI-compatible Ollama
endpoint. Callers provide a system prompt and messages; the boundary enforces
request limits and returns final text only. `src/server/agent/agent.ts` and
`src/server/curriculum/curriculum-pi-agent.ts` parse and validate their own
structured outputs before any application sink.

This is not a Pi-agent-core runtime: no agent loop, tool registry, MCP surface,
A2UI renderer, autonomous filesystem access, database authority, or
authorization authority is present in the application flow.

## Module map

| Module                                     | Owns                                                               | Must not own                        |
| ------------------------------------------ | ------------------------------------------------------------------ | ----------------------------------- |
| `web/app/`                                 | pages, browser state, same-origin route adapters                   | server policy or direct persistence |
| `web/components/`                          | application-owned presentation                                     | server calls or authorization       |
| `web/server/identity/`                     | session resolution, role checks, origin proof, session-owned state | feature persistence policy          |
| `web/server/learning/`                     | practice progression, assessment lifecycle, redacted history       | curriculum promotion                |
| `web/server/curriculum/`                   | catalog, promotion, Gold reads/writes, vectors and retrieval       | learner authorization               |
| `web/server/persistence/`                  | SQLite paths, connection policy, ordered migrations                | feature-specific business policy    |
| `web/server/agent/` and `pi-completion.ts` | question selection/generation and bounded completion               | direct data writes or authorization |
| `web/server/validation/`                   | boundary schemas and safe generated-payload validation             | orchestration or persistence        |

## Public route contracts

These same-origin routes are compatibility surfaces. “Learner mutation proof”
means a learner session plus the shared same-origin POST proof. “Admin mutation
proof” is the corresponding administrator check. Response bodies are summarized
rather than copied verbatim; route tests and handlers are the field-level source
of truth.

| Method and path              | Authorization currently enforced | Contract                                                                                                     |
| ---------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `GET /api/session`           | any valid session                | Current session projection; otherwise `401`.                                                                 |
| `POST /api/session`          | none                             | Starts a session from the sign-in payload; returns a safe session projection or `401`.                       |
| `DELETE /api/session`        | session cookie, if present       | Ends that session and clears the cookie; returns `204`.                                                      |
| `GET /api/curriculum/browse` | none                             | Subject → grade → domain → standard tree.                                                                    |
| `GET /api/curriculum/search` | none                             | Bounded text search.                                                                                         |
| `GET /api/progress`          | learner session                  | Learner progress plus one server-bound practice assignment; no-store response.                               |
| `POST /api/answer`           | learner mutation proof           | Consumes one practice assignment and returns feedback/progress projection; errors are intentionally generic. |
| `GET /api/test`              | learner session                  | Reads an identified or active learner assessment and prepares the current question when necessary.           |
| `POST /api/test`             | learner mutation proof           | Starts or resumes a learner-scoped mixed-skill assessment.                                                   |
| `POST /api/test/answer`      | learner mutation proof           | Grades the opaque assignment-bound assessment answer and returns the next safe assessment projection.        |
| `POST /api/test/exit`        | learner mutation proof           | Records a partial assessment and returns its terminal projection.                                            |
| `GET /api/curriculum/gold`   | admin session                    | Gold records, aggregate stats, or topics.                                                                    |

## Guidance hierarchy

Use the root `AGENTS.md` as the repository policy, then
[`web/AGENTS.md`](../../web/AGENTS.md) for package-specific rules
(test isolation, e2e harness, server-only discipline, the generation
boundary). The former per-subtree guides were consolidated into that single
file when the `src/` layer was removed; `CLAUDE.md` at the root still points
readers to `AGENTS.md`.

## Historical records

`docs/adr/` and `docs/rfc/` are retained as frozen records of past decisions
and proposals. They may describe superseded package layout, agent concepts, or
planned integrations. Use this document and `reference.md` for the current
system; add a new decision record rather than rewriting historical rationale.
