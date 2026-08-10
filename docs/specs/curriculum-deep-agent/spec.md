# Spec: curriculum deep agent

- **Status:** Draft
- **Plan:** [plan.md](plan.md)
- **Constrained by:** ADR-0001, ADR-0003, ADR-0004, RFC-0002
- **Contract:** none
- **Shape:** mixed

## Objective

The `curriculum-document` skill gives a Curriculum Steward a reusable deep-agent
workflow for transforming an uploaded curriculum document into evidence-backed
Silver and Gold outputs. The agent inspects a source manifest, plans which pages
to read, reads only bounded page ranges through skills, preserves page evidence,
and produces structured outputs that application code validates and governs.

## Boundaries

### Always do

- Register `curriculum-document` as the first application-owned agent skill.
- Have application code inspect PDF, CSV, JSON, and text sources into a manifest
  before any model run. The model may inspect that safe manifest, never a source
  handle or raw source bytes.
- Represent PDF source content as indexed pages with stable page numbers; the
  agent reads a bounded page range through a `read_pages` tool.
- Run the same reusable deep-agent framework for Bronze → Silver cleanup and
  Silver → Gold formalization, selecting only stage-specific prompt profiles,
  output schemas, and allowed skills.
- Preserve source fingerprint, page evidence, prompt version, model version,
  and skill version on every Silver and Gold output.
- Keep Bronze and Silver temporary; pass approved Silver—not raw document
  pages—to the Gold profile.

### Ask first

- Add a document format, OCR provider, cloud parser, external agent tool, or
  background/event worker.
- Add a curriculum-document skill capability outside source inspection, page
  reading, Silver cleanup, or Gold formalization.
- Allow a skill to write Gold, approve a stage, access child data, or modify
  question generation.

### Never do

- Put an entire PDF or unbounded source document into one model context.
- Give the agent browser, shell, filesystem, network, database, approval, or
  persistence tools.
- Treat model output as official curriculum without schema and source-evidence
  validation by application code.
- Put raw source bytes, prompts, tool implementations, or SQL in browser code.

## Deep-agent contract

`CurriculumDocumentAgent.run({ stage, manifest, approvedSilver? })` executes a
bounded run graph:

1. Application-owned source inspection creates and stores the safe document
   manifest before the model starts. `inspect_source` returns that manifest to
   the model without granting source-handle access.
2. `plan_pages` returns one or more bounded page ranges justified by the stage.
3. `read_pages` returns only requested indexed pages: at most **3 pages and
   12,000 characters** in one model read window. A Bronze → Silver source may
   use several independently-contexted read windows; each emits temporary
   evidence-backed candidates before a later consolidation pass. No model
   context accumulates the full document.
4. `synthesize` returns JSON matching the selected Silver or Gold schema.
5. Application code validates output/evidence and either retains a temporary
   candidate or persists approved Gold through its semantic index.

The framework owns budgets, timeouts, prompt selection, tool authorization,
run trace, and JSON parsing. A profile owns its system prompt, output validator,
and the subset of registered skills it may call.

Gold persistence has two distinct responsibilities: application code stores
canonical structured Gold records and their local SQLite-Vec embeddings under
ADR-0004; the Engram adapter, under ADR-0003, owns any memory or knowledge-graph
projection derived from that canonical copy. Neither system replaces the other
or forms a custom combined retrieval layer.

### `curriculum-document` skill

| Capability        | Input                       | Output                                              | Available stages |
| ----------------- | --------------------------- | --------------------------------------------------- | ---------------- |
| `inspect_source`  | application-owned manifest  | manifest: format, fingerprint, page count, warnings | Bronze → Silver  |
| `plan_pages`      | manifest and stage goal     | bounded page ranges                                 | Bronze → Silver  |
| `read_pages`      | manifest ID and page ranges | page-numbered text                                  | Bronze → Silver  |
| `approved_silver` | approved Silver handle      | structured Silver only                              | Silver → Gold    |

The Gold profile has no page reader. It receives only the application-provided,
approved Silver payload and its provenance.

## Testing Strategy

- TDD: manifest validation, page-range budget, skill authorization, run graph,
  source-evidence preservation, and stage-specific schema guards.
- Integration: local PDF text extraction into page-indexed data; Pi fixture runs
  that select `read_pages`; rejected full-document/unauthorized-tool requests.
- Manual: a steward uploads a multi-page PDF, observes a page-reading trace,
  approves Silver, and confirms Gold retains Silver/source provenance.

## Acceptance Criteria

- [ ] `curriculum-document` is registered as an application-owned reusable
      deep-agent skill with an explicit version and capability manifest.
- [ ] A multi-page PDF produces a page-indexed Bronze manifest; no single Pi
      read window contains more than 3 pages or 12,000 characters, and no model
      context accumulates the complete document.
- [ ] The Bronze → Silver profile can inspect, plan, and read bounded pages;
      every Silver record includes a valid source page from the manifest.
- [ ] The Silver → Gold profile receives approved Silver only and cannot invoke
      the page-reading skill; every Gold record preserves matching Silver text
      and source location.
- [ ] A profile cannot invoke undeclared capabilities, persist data, approve a
      promotion, access child data, or use browser/shell/network tools.
- [ ] Agent output records stage, prompt version, skill version, model version,
      source fingerprint, and page evidence.
- [ ] Gold's authoritative semantic records and embeddings live in SQLite-Vec;
      only the Engram adapter owns the derived memory/knowledge-graph projection.
- [ ] A steward can see a compact document manifest and page-reading trace in
      the desktop ingestion workflow.

## Assumptions

- Technical: Pi Core 0.84.1 is the server-only runtime for the reusable agent
  boundary (source: app/package.json).
- Technical: the source-neutral promotion state machine remains in
  `packages/curriculum/` (source: packages/curriculum/src/promotion-workflow.ts).
- Process: bounded Pi transformations and application-owned approvals follow
  RFC-0002 (source: docs/rfc/0002-adopt-curriculum-source-promotion.md).
- Product: `curriculum-document` is the first agent skill; question and diagram
  generation are out of scope (source: user confirmation 2026-08-09).
