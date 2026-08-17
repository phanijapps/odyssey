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
4. The answer route may write a derived memory signal and graph projection
   after the durable practice result. Those best-effort projections cannot
   change the result.
5. History projects practice attempts and terminal assessments without raw
   submitted answers.

### Retention and cleanup

The local SQLite learning store retains progression, redacted practice attempts,
and terminal assessment history until a future user-driven reset/export contract
exists. Active assessments are resumable state and are never automatically
deleted.

Session cleanup is opportunistic: normal authentication/session activity removes
rows past the 30-minute idle or eight-hour absolute limit. Deleting that row also
removes its session-owned plaintext question pool and assignment token; there is
no scheduler or background daemon. Bronze, Silver, and pending Gold workflow
artifacts carry a 24-hour expiry, are purged by the next workflow operation, and
are deleted after successful Gold finalization. Approved Gold remains durable.

Profile-memory, knowledge-graph, and vector data are derived, non-authoritative
projections. Existing indexing/seeding paths can restore projections from
reviewed Gold and durable learning records where supported; a missing projection
must not change learning or assessment history.

### Curriculum and retrieval

1. An administrative ingestion starts as Bronze. Explicit administrative
   actions advance it through reviewed Silver and Gold stages.
2. The curriculum workflow may request structured text completion for its
   bounded transformation stages. Application validation is responsible for
   candidate shape and promotion; the completion boundary has no promotion or
   persistence authority.
3. Gold persistence writes canonical records to the curriculum SQLite store.
   It separately attempts a native graph projection and local vector projection.
4. Browse and text search read the current catalog. Semantic search creates a
   local embedding, retrieves a bounded vector candidate set, and falls back to
   text search if embedding or vector retrieval fails.

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

| Module                                     | Owns                                                               | Must not own                          |
| ------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------- |
| `src/app/`                                 | pages, browser state, same-origin route adapters                   | server policy or direct persistence   |
| `src/components/`                          | application-owned presentation                                     | server calls or authorization         |
| `src/server/identity/`                     | session resolution, role checks, origin proof, session-owned state | feature persistence policy            |
| `src/server/learning/`                     | practice progression, assessment lifecycle, redacted history       | curriculum promotion                  |
| `src/server/curriculum/`                   | catalog, promotion, Gold reads/writes, vectors and retrieval       | learner authorization                 |
| `src/server/persistence/`                  | SQLite paths, connection policy, ordered migrations                | feature-specific business policy      |
| `src/server/agent/` and `pi-completion.ts` | question selection/generation and bounded completion               | direct data writes or authorization   |
| `src/server/memory/`                       | optional derived-signal and graph projections                      | authority over progress or curriculum |
| `src/server/validation/`                   | boundary schemas and safe generated-payload validation             | orchestration or persistence          |

## Public route contracts

These same-origin routes are compatibility surfaces. “Learner mutation proof”
means a learner session plus the shared same-origin POST proof. “Admin mutation
proof” is the corresponding administrator check. Response bodies are summarized
rather than copied verbatim; route tests and handlers are the field-level source
of truth.

| Method and path                                        | Authorization currently enforced                                | Contract                                                                                                     |
| ------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `GET /api/session`                                     | any valid session                                               | Current session projection; otherwise `401`.                                                                 |
| `POST /api/session`                                    | none                                                            | Starts a session from the sign-in payload; returns a safe session projection or `401`.                       |
| `DELETE /api/session`                                  | session cookie, if present                                      | Ends that session and clears the cookie; returns `204`.                                                      |
| `GET /api/topics`                                      | none                                                            | Reviewed catalog topic list.                                                                                 |
| `GET /api/curriculum/browse`                           | none                                                            | Subject → grade → domain → standard tree.                                                                    |
| `GET /api/curriculum/search`                           | none                                                            | Bounded text search; `semantic=1` attempts local vector retrieval, then text fallback.                       |
| `GET /api/progress`                                    | learner session                                                 | Learner progress plus one server-bound practice assignment; no-store response.                               |
| `POST /api/answer`                                     | learner mutation proof                                          | Consumes one practice assignment and returns feedback/progress projection; errors are intentionally generic. |
| `POST /api/generated-question`                         | learner mutation proof and a previously granted topic allowance | Returns one validated generated question or an unavailable response.                                         |
| `GET /api/test`                                        | learner session                                                 | Reads an identified or active learner assessment and prepares the current question when necessary.           |
| `POST /api/test`                                       | learner mutation proof                                          | Starts or resumes a learner-scoped mixed-skill assessment.                                                   |
| `POST /api/test/answer`                                | learner mutation proof                                          | Grades the opaque assignment-bound assessment answer and returns the next safe assessment projection.        |
| `POST /api/test/exit`                                  | learner mutation proof                                          | Records a partial assessment and returns its terminal projection.                                            |
| `GET /api/parent/summary`                              | any valid session                                               | Progress summary scoped to the caller's session child.                                                       |
| `POST /api/parent/chat`                                | any valid session                                               | Bounded structured-progress reply for the caller's session child.                                            |
| `GET /api/curriculum/gold`                             | admin session                                                   | Gold records, aggregate stats, or topics.                                                                    |
| `DELETE /api/curriculum/gold`                          | admin mutation proof                                            | Deletes one Gold record by identifier.                                                                       |
| `POST /api/curriculum/ingestions`                      | admin mutation proof                                            | Creates a temporary Bronze workflow from one validated upload.                                               |
| `GET /api/curriculum/ingestions/:ingestionId`          | admin session                                                   | Safe review view of one temporary workflow.                                                                  |
| `POST /api/curriculum/ingestions/:ingestionId/actions` | admin mutation proof                                            | Performs one explicit workflow action.                                                                       |
| `GET /api/knowledge`                                   | admin session                                                   | Graph diagnostics or a query result.                                                                         |
| `POST /api/knowledge`                                  | admin mutation proof                                            | Seeds the curriculum graph and returns diagnostics.                                                          |
| `GET /api/memory`                                      | none                                                            | Availability state for the optional memory integration; no-store response.                                   |

## Guidance hierarchy

Use the root `AGENTS.md` as the repository policy, then the applicable guides in
this order: `app/AGENTS.md` → `app/src/AGENTS.md` → the nearest subtree guide.
For example, an assessment route follows the root, app, source, App Router,
API, and test-route guides. The nearest applicable guide adds constraints; it
does not replace higher-level requirements. `CLAUDE.md` mirrors this discovery
path by pointing at its sibling guide.

## Historical records

`docs/adr/` and `docs/rfc/` are retained as frozen records of past decisions
and proposals. They may describe superseded package layout, agent concepts, or
planned integrations. Use this document and `reference.md` for the current
system; add a new decision record rather than rewriting historical rationale.
