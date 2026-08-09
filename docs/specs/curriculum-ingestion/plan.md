# Plan: curriculum ingestion

- **Spec:** [spec.md](spec.md)
- **Status:** Drafting

## Tasks

### T1: Add temporary upload and promotion state

**Depends on:** none

**Tests:** TDD `app/src/server/curriculum/source-importer.test.ts` and
`packages/curriculum/src/promotion-workflow.test.ts`; manual desktop flow in
`docs/specs/curriculum-ingestion/notes/manual-qa.md`.

**Approach:** Add a focused upload route and in-memory/temporary JSON workflow
store. Reuse the canonical promotion state machine; do not persist Bronze/Silver.

### T2: Add bounded reusable Pi agent runner and stage prompts

**Depends on:** T1

**Tests:** TDD `app/src/server/curriculum/curriculum-pi-agent.test.ts` for
JSON-only outputs, separate prompt selection, strict schemas, and rejection of
unapproved inputs.

**Approach:** Create one runner with `bronze-to-silver` and `silver-to-gold`
profiles, focused prompt files, and validators. Do not give the runner approval
authority.

### T3: Persist and index approved Gold

**Depends on:** T2

**Tests:** Integration `app/src/server/curriculum/gold-semantic-index.test.ts`
for Gold persistence, Engram projection, SQLite-Vec indexing, provenance, and
Gold-only retrieval guards.

**Approach:** Write approved Gold through the query catalog, build Gold
relations through the server-only Engram adapter, and create local
SQLite-Vec/hybrid-reranking candidates from Gold only.

### T4: Build compact desktop steward UI

**Depends on:** T1, T2, T3

**Tests:** Manual desktop workflow from upload through indexed Gold in
`docs/specs/curriculum-ingestion/notes/manual-qa.md`.

**Approach:** Use Shadcn form, card, table, dialog, and progress components;
avoid custom UI primitives and keep file/progress/approval actions above fold.
