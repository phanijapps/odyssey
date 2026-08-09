# Plan: curriculum ingestion

- **Spec:** [spec.md](spec.md)
- **Status:** Drafting

## Implementation order

The work is intentionally sequential: each promotion stage exposes a narrow,
reviewable artifact before the next stage is allowed to run. Bronze and Silver
stay in the temporary workflow store; only the approved Gold projection reaches
SQLite, SQLite-Vec, and Engram.

### T1: Define temporary intake and promotion contracts

**Depends on:** none

**Tests:** TDD `app/src/server/curriculum/source-importer.test.ts` and
`packages/curriculum/src/promotion-workflow.test.ts` for accepted PDF, CSV,
JSON, and text metadata; rejected files; content fingerprinting; and the four
legal promotion transitions.

**Approach:** Extend the source-neutral importer with a bounded upload metadata
contract: filename, MIME type, byte size, normalized format, fingerprint, and
validation warnings. Keep source bytes plus Bronze/Silver artifacts in the
existing in-memory/temporary JSON promotion store. Do not introduce a database
table for either stage.

**Done when:** A validated temporary Bronze record can be created without
persisting source bytes or Silver content to SQLite.

### T2: Add the desktop intake route

**Depends on:** T1

**Tests:** TDD `app/src/app/api/curriculum/ingestions/route.test.ts` for valid
multipart submissions, unsupported formats, missing files, oversized input, and
the returned Bronze identifier/state.

**Approach:** Add one server-only `POST /api/curriculum/ingestions` route. It
parses one submitted file, calls the T1 validator, creates the temporary Bronze
promotion, and returns a small safe status payload. The route never exposes raw
file contents in its response.

**Done when:** A browser form can submit one supported local file and receive a
Bronze validation result and promotion identifier.

### T3: Add steward actions for the state machine

**Depends on:** T1, T2

**Tests:** TDD `app/src/app/api/curriculum/ingestions/[ingestionId]/route.test.ts`
for reading a safe temporary-status view and
`app/src/app/api/curriculum/ingestions/[ingestionId]/actions/route.test.ts` for
rejecting illegal approval/advance actions.

**Approach:** Add server-only status and action routes that resolve the
promotion identifier through the temporary store. Implement only explicit
steward actions: approve Bronze, generate Silver, approve Silver, generate
Gold, and expire/cancel the temporary workflow. Return stage, validation,
warnings, and reviewable candidate summaries; never return raw source bytes.

**Done when:** Every transition is enforced by the shared promotion state
machine rather than by browser state or an agent response.

### T4: Build the reusable Pi runner and prompt registry

**Depends on:** T1

**Tests:** TDD `app/src/server/curriculum/curriculum-pi-agent.test.ts` for
stage-to-prompt selection, JSON-only parsing, output-schema validation, model
provenance, input bounds, timeout errors, and rejection of unapproved inputs.

**Approach:** Create one server-only `CurriculumPiAgent.run` boundary and a
small prompt registry. Add exactly two versioned system-prompt files:
`bronze-to-silver.system.md` and `silver-to-gold.system.md`. Send source/Silver
payloads as clearly delimited data messages, not system instructions. Keep model
configuration in environment variables and preserve Pi as the execution engine.

**Done when:** The same runner executes either stage with its own schema and
prompt provenance, without authority to approve or persist curriculum.

### T5: Generate and retain the Silver candidate

**Depends on:** T3, T4

**Tests:** Extend `app/src/server/curriculum/curriculum-pi-agent.test.ts` and
`app/src/server/curriculum/promotion-store.test.ts` to prove approved Bronze is
the only agent input, every extracted record retains source locations, warnings
survive, and Silver remains temporary.

**Approach:** Wire the `generate Silver` steward action to the
`bronze-to-silver` profile. Validate `{ sourceSummary, records, warnings }`,
attach source locations and Pi provenance, then write the candidate only to the
temporary workflow store for steward review.

**Done when:** An approved Bronze workflow displays a schema-valid Silver
candidate and cannot advance until the steward separately approves it.

### T6: Formalize approved Silver into a validated Gold draft

**Depends on:** T3, T4, T5

**Tests:** Extend `app/src/server/curriculum/curriculum-pi-agent.test.ts` for
the `silver-to-gold` schema, source-link preservation, rejected unapproved
Silver, and prohibited unsupported curriculum claims.

**Approach:** Wire the `generate Gold` steward action to the
`silver-to-gold` profile. Validate canonical records, relations, topics, and
assessment targets. Associate every candidate with approved-Silver identifiers,
source fingerprint/location, prompt version, and model version before it enters
the Gold persistence boundary.

**Done when:** Only an approved Silver artifact can yield a validated Gold
payload with complete provenance.

### T7: Persist and semantically index approved Gold

**Depends on:** T6

**Tests:** TDD `app/src/server/curriculum/gold-semantic-index.test.ts` for
query-catalog persistence, Gold provenance, Engram graph projection,
SQLite-Vec vector insertion, and rejection of Bronze/Silver at each indexer
entry point.

**Approach:** Add a server-only Gold semantic-index service. It persists
canonical Gold records through named SQL entries in
`app/src/server/curriculum/sqlite-queries.json`, projects Gold relations through
the Engram adapter, embeds Gold text using the local Ollama adapter, and writes
the embedding to SQLite-Vec. No SQL text belongs in TypeScript and no temporary
artifact can reach this service.

**Done when:** Approved Gold is the only durable curriculum data and has both
an Engram graph representation and a SQLite-Vec representation.

### T8: Add Gold-only hybrid retrieval and reranking input

**Depends on:** T7

**Tests:** TDD `app/src/server/curriculum/gold-semantic-search.test.ts` for
vector candidates, Engram relation candidates, deduplication, Gold-only guards,
and deterministic reranking input order.

**Approach:** Create a server-only retrieval service that combines SQLite-Vec
neighbors with Engram graph neighbors, removes duplicates, and passes only Gold
records with provenance to the reranker/question-context boundary. This task
does not change question generation itself.

**Done when:** A topic query yields a provenance-preserving ranked Gold context,
and temporary stages are structurally unable to appear in results.

### T9: Connect the compact Shadcn desktop steward workflow

**Depends on:** T2, T3, T5, T6, T7

**Tests:** Manual desktop workflow recorded in
`docs/specs/curriculum-ingestion/notes/manual-qa.md`; component-level state test
in `app/src/app/ingestion/page.test.tsx` for disabled and available actions.

**Approach:** Replace the current local-only ingestion screen state with the
T2/T3 routes. Use existing Shadcn form, card, table, dialog, badge, and progress
components for: file selection/submission; Bronze validation; explicit Bronze
approval; Silver review/approval; Gold result/provenance; and terminal errors.
Keep the desktop workflow compact and do not modify child/parent learning
screens.

**Done when:** A steward can complete the entire staged workflow from `/ingestion`
without using developer tools, and each stage clearly shows its next allowed
action.

### T10: Verify the real local integration

**Depends on:** T8, T9

**Tests:** Run lint, typecheck, deterministic tests, production build, and the
manual QA document. Run the optional local Ollama integration test only when the
configured embedding model is available; otherwise record the exact skipped
command and reason in the manual QA document.

**Approach:** Start the one-port Next.js application, submit representative
PDF/CSV/JSON/text fixtures through the browser, approve both gates, confirm
Gold is indexed in SQLite-Vec and Engram, and confirm the semantic search path
returns Gold-only context.

**Done when:** The documented browser workflow and the local semantic retrieval
smoke test both succeed with observed results recorded.

## Assumptions

- Local-only ingestion accepts one reasonably sized file at a time; maximum
  size is finalized in T1 from existing local runtime limits.
- Pi and Ollama configuration remain environment-driven and server-only.
- Existing child authentication is untouched; curriculum-steward authorization
  is represented by the workflow boundary until the persona auth spec lands.

## Declined additions

- Bulk ingestion and background/event processing — deferred because the local
  first slice requires one reviewable workflow.
- Cloud object storage — Bronze source material is deliberately ephemeral.
- New UI primitives — the ingestion view uses existing Shadcn components.
