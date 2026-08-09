# Plan: curriculum ingestion

- **Spec:** [spec.md](spec.md)
- **Status:** Drafting

## Tasks

### T1: Add temporary upload and promotion state

**Depends on:** none

**Tests:** TDD source metadata/file-type validation and Bronze/Silver state
transitions; visual desktop upload flow.

**Approach:** Add a focused upload route and in-memory/temporary JSON workflow
store. Reuse the canonical promotion state machine; do not persist Bronze/Silver.

### T2: Add bounded reusable Pi agent runner

**Depends on:** T1

**Tests:** TDD JSON-only outputs, versioned prompt selection, strict schemas,
and rejection of unapproved inputs.

**Approach:** Create one runner plus focused extraction/formalization adapters,
prompt files, and validators. Do not give either adapter approval authority.

### T3: Persist and index approved Gold

**Depends on:** T2

**Tests:** Integration Gold persistence, provenance, graph/vector preparation,
and Gold-only retrieval guard.

**Approach:** Write approved Gold through the query catalog, then build graph
relations and local vector/hybrid-reranking candidates from Gold only.

### T4: Build compact desktop steward UI

**Depends on:** T1, T2, T3

**Tests:** Manual desktop workflow from upload through indexed Gold.

**Approach:** Use Shadcn form, card, table, dialog, and progress components;
avoid custom UI primitives and keep file/progress/approval actions above fold.
