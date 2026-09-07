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
and terminal assessment history without automatic history purge. Parents can export linked-child progress;
there is no learner-history reset contract. Active assessments are resumable state and are never automatically
deleted.

Session cleanup is opportunistic: normal authentication/session activity removes
rows past the 30-minute idle or eight-hour absolute limit. Deleting that row also
removes its session-owned plaintext question pool and assignment token; there is
no scheduler or background daemon.

### Curriculum and retrieval

1. The curriculum source of record is the reviewed, versioned JSON catalog
   (`packages/core/src/curriculum/data/ohio-catalog.json`). An idempotent, hash-guarded
   seeder upserts it into `gold_curriculum_records` on curriculum-database
   open; `ODYSSEY_SEED_CATALOG=0` disables seeding for exact-fixture tests.
2. Browse and text search read the seeded Gold store. There is no runtime
   ingestion workflow; catalog changes are reviewed code changes.

### Pi AI completion boundary

`packages/ai/src/providers/pi-completion.ts` configures `@earendil-works/pi-ai`
for stateless text completion against the local compatible endpoint. The atlas
caller sends only a reviewed standard's code/text and versioned prompt constants,
with a 90-second timeout, 16,384 output tokens and at most one transport retry.
`packages/ai/src/atlas-generator.ts` validates unknown JSON, prunes invalid nodes
independently and requires 4–15 unique questions, at least two concepts and all
three tiers. Nonempty invalid diagrams reject their entire node; answer keys
are preserved without truncation. Disabled generation makes no completion calls.
The separate single-question generator remains available for assessment preparation.

This is not a Pi-agent-core runtime: no agent loop, tool registry, MCP surface,
A2UI renderer, autonomous filesystem access, database authority, or
authorization authority is present in the application flow.

## Module map

| Module                                  | Owns                                                          | Must not own                               |
| --------------------------------------- | ------------------------------------------------------------- | ------------------------------------------ |
| `webapp/app/`                           | Thin pages and same-origin route adapters                     | Database schema or provider implementation |
| `webapp/modules/`, `webapp/components/` | Browser state and presentation                                | Server policy or direct persistence        |
| `webapp/server/identity/`               | Session resolution, roles, origin proof, session pool         | Learning progression policy                |
| `webapp/server/learning/`               | Practice progression, assessment lifecycle, redacted history  | Curriculum promotion                       |
| `packages/core/src/`                    | Bank, atlas walk, grading, curriculum source, validators      | I/O or learner authorization               |
| `packages/db/src/`                      | SQLite connections, migrations, seeding and repositories      | Browser presentation or provider calls     |
| `packages/ai/src/`                      | Bounded completions, prompts and generated-payload validation | Data writes or authorization               |

### Practice atlas lifecycle

The progress route creates a session pool with a unique generation identity using
a conditional write. Only its winning creator launches background generation,
and only when one reviewed standard resolves and generation is enabled. A bank
question can be claimed immediately. Without bank coverage, the route returns a
pending projection while the same atlas request runs.

Repeated reads share the active assignment token. Completion checks the current
pool identity and conditionally adds the atlas while retaining already shown
questions and accepted answers. Results for a replaced pool or ended session
are discarded. This includes switching from one skill to another and back.

The walker starts at tier 1 regardless of node ordering. Correct answers deepen
within a concept, then widen; incorrect answers prefer an unasked same-tier
sibling. Nodes never repeat. Optional prerequisites supplied by core callers are
honored, but generated batches contain concept/tier metadata without edges.
Answer submission consumes its assignment transactionally and records the outcome
for the next walk; it never calls the provider.

Pending generation expires after 240 seconds, including after a process restart.
Ordinary reads cannot create retry loops. `restart=1` starts a new round only for
an inactive terminal pool of the same skill; it cannot interrupt an active
assignment or pending generation. Concurrent restart reads share the new round.

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

### Progress response states

| State                                    | Status | Projection                                                                          |
| ---------------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| Ready                                    | 200    | `nextQuestion` with assignment token, plus `poolProgress` position/total/difficulty |
| Pending without a bank question          | 200    | `nextQuestion: null`, `questionPending: true`                                       |
| Completed                                | 200    | `nextQuestion: null`, `poolExhausted: true`, final `poolProgress`                   |
| Unavailable without usable bank coverage | 409    | Generic practice-unavailable error                                                  |
| Invalid reviewed selection               | 400    | Generic selection error                                                             |
| Unauthorized                             | 401    | Sign-in or learner-access error                                                     |

Practice state responses use `Cache-Control: no-store`. Browser projections omit
answer keys before submission, internal generation identity, atlas walk state and
provider errors. The UI polls pending reads and exposes completion and retry
states separately.

The table above covers core learning routes. Additional handlers under
`webapp/app/api/` serve performance and plans, parent accounts/children/exports,
suggested practice, and administrator health/backups. Their handlers and route
tests define the detailed transport contracts.

## Guidance hierarchy

Use the root `AGENTS.md` as the repository policy, then
[`webapp/AGENTS.md`](../../webapp/AGENTS.md) for package-specific rules
(test isolation, e2e harness, server-only discipline, the generation
boundary). The former per-subtree guides were consolidated into that single
file when the `src/` layer was removed; `CLAUDE.md` at the root still points
readers to `AGENTS.md`.

## Historical records

`docs/adr/` and `docs/rfc/` are retained as frozen records of past decisions
and proposals. They may describe superseded package layout, agent concepts, or
planned integrations. Use this document and `reference.md` for the current
system; add a new decision record rather than rewriting historical rationale.
