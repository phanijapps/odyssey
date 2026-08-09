# Spec: curriculum ingestion

- **Status:** Draft
- **Plan:** [plan.md](plan.md)
- **Constrained by:** RFC-0002, RFC-0003
- **Shape:** mixed

## Objective

A Curriculum Steward can upload one desktop source file, inspect the Bronze
validation result, approve it, inspect the Silver extraction-agent result,
approve it, and create Gold canonical curriculum. Only Gold records feed
question generation and semantic retrieval.

## Boundaries

### Always do

- Provide a visible desktop upload control for PDF, CSV, JSON, and text.
- Keep Bronze source bytes and Silver candidates temporary (in memory or a
  temporary JSON artifact); preserve source fingerprint and validation result.
- Use one reusable bounded Pi agent runner with stage-specific capabilities and
  system-prompt profiles: cleanup/normalization for approved Bronze and
  formalization for approved Silver.
- Keep agent prompts versioned in focused files, validate every output against
  strict schemas, and record prompt/model/version provenance with Gold.
- Persist only approved Gold canonical records, embedding metadata, and vector
  data through named datastore-query catalogs; write Gold relations to the
  server-only Engram knowledge graph.

### Ask first

- Add a file type, cloud storage, external model provider, agent tool, or
  event-driven worker.
- Permit bulk upload or modify Gold after approval.

### Never do

- Allow agents to approve a promotion, write Gold directly, or read child data.
- Generate questions, graph relations, vectors, hybrid search results, or
  reranking candidates from Bronze or Silver.
- Put raw files, unbounded prompts, or SQL text in browser code.

## Agent contracts

### Reusable Pi agent runner

`CurriculumPiAgent.run({ stage, input, promptVersion })` is the only agent
execution boundary. It enforces local model selection, timeout, JSON-only
responses, schema validation, audit redaction, and bounded input. Stage profiles
select one of two immutable, versioned system-prompt files and output schemas:
`bronze-to-silver.system.md` and `silver-to-gold.system.md`. Source and approved
Silver content travel only in separate delimited data messages; the runner never
approves or persists promotions.

### Bronze → Silver cleanup profile

`run({ stage: "bronze-to-silver", source, sourceFingerprint, format })` returns
only `{ sourceSummary, records, warnings }`. Its prompt treats source content as
data, requires exact source locations for every extracted record, requires it to
preserve uncertainty in `warnings`, and forbids curriculum approval or invented
standards. The application validates this response before it becomes Silver.

### Silver → Gold formalization profile

`run({ stage: "silver-to-gold", approvedSilver, framework })` returns only
`{ canonicalRecords, relations, topics, assessmentTargets }`. Its prompt permits
only the approved Silver payload, requires every Gold record to retain a source
link, and forbids changing official text or creating unrelated curriculum. The
application validates it, stores it as a Gold draft, and only then indexes it.

Gold semantic indexing writes canonical Gold records and relations to Engram's
knowledge graph, stores local embeddings in SQLite-Vec, retrieves with graph
and vector candidates, and reranks only Gold candidates before question context
is selected.

## Testing Strategy

- TDD: stage transitions, upload metadata validation, output schemas, and
  Gold-only access invariants.
- Integration: local file upload, deterministic agent fixtures, Gold persistence,
  local Ollama embeddings, SQLite-Vec retrieval, and reranking input boundaries.
- Manual: desktop steward uploads PDF/CSV/JSON/text, observes both approvals,
  and confirms Gold appears in semantic search while Bronze/Silver do not.

## Acceptance Criteria

- [ ] A desktop steward can select and submit a PDF, CSV, JSON, or text file
      from the ingestion screen and sees its Bronze validation state.
- [ ] Bronze cannot enter Silver before steward approval, and Silver cannot
      enter Gold before a separate steward approval.
- [ ] One reusable Pi agent runner executes stage-specific, versioned JSON-only
      system prompts for Bronze cleanup and Silver formalization; each output is
      schema-validated.
- [ ] Gold records preserve source fingerprint/location and agent provenance.
- [ ] Only Gold records are projected into the server-only Engram knowledge
      graph and SQLite-Vec; Bronze/Silver are rejected from both, hybrid
      retrieval/reranking, and generated-question context.
- [ ] Bronze and Silver temporary artifacts expire after the local workflow and
      never appear in child or parent interfaces.
