# Plan: curriculum deep agent

- **Spec:** [spec.md](spec.md)
- **Status:** Drafting

## Architecture

```
temporary source → source manifest → curriculum-document skill
                                      ├─ inspect_source
                                      ├─ plan_pages
                                      └─ read_pages
                                              ↓
                                Bronze → Silver Pi profile
                                              ↓ approval
                                Silver → Gold Pi profile
                                              ↓
                  canonical Gold + SQLite-Vec embeddings (ADR-0004)
                                              ↓
                  Engram memory / knowledge-graph projection (ADR-0003)
```

The framework and its source and promotion contracts stay server-only under
`app/src/server/curriculum/`. Application code creates the manifest before a
model runs; the model receives that safe manifest only. Each model read window is
capped at three pages and 12,000 characters, and page batches use independent
model contexts. The browser sees only safe manifests, traces, candidates, and
status—not source bytes or tools.

## Tasks

### T1: Define deep-agent run and skill contracts

**Depends on:** none

**Tests:** TDD `app/src/server/curriculum/deep-agent/contracts.test.ts` for
stage profiles, capability allowlists, run trace shape, and rejected capabilities.

**Artifacts:** Create `app/src/server/curriculum/deep-agent/contracts.ts`,
`app/src/server/curriculum/deep-agent/contracts.test.ts`, and
`app/src/server/curriculum/deep-agent/skills/curriculum-document.ts`.

**Reuse:** `CurriculumPiAgent` Pi execution boundary and promotion stage types.

**Done when:** One typed skill manifest declares all and only the
`curriculum-document` capabilities.

### T2: Build source manifests and page-indexed PDF extraction

**Depends on:** T1

**Tests:** TDD `app/src/server/curriculum/deep-agent/source-manifest.test.ts`
for application-owned PDF page numbering, CSV/JSON/text manifests,
fingerprints, empty pages, and extraction failures.

**Artifacts:** Create `app/src/server/curriculum/deep-agent/source-manifest.ts`,
`app/src/server/curriculum/deep-agent/pdf-page-extractor.ts`, their tests, and
temporary manifest storage in `promotion-store.ts`.

**Reuse:** Existing upload validator, local `pdftotext` extraction, temporary
workflow store, and source fingerprints.

**Done when:** A PDF becomes stable page-indexed data before any agent run.

### T3: Implement bounded page planning and reading tools

**Depends on:** T1, T2

**Tests:** TDD `app/src/server/curriculum/deep-agent/page-reader.test.ts` for
page-range validation, the 3-page/12,000-character read-window budget,
independent page-batch contexts, manifest confinement, and rejected
full-document reads.

**Artifacts:** Create `app/src/server/curriculum/deep-agent/page-reader.ts`,
`app/src/server/curriculum/deep-agent/page-planner.ts`, tests, and a versioned
`curriculum-document.skill.md` capability description.

**Reuse:** Pi tool authorization hooks and the T2 page-indexed manifest.

**Done when:** The framework exposes `read_pages` only through the registered
skill, never serializes a whole PDF into a prompt, and never accumulates a full
document across one model context.

### T4: Run Bronze → Silver through the deep-agent graph

**Depends on:** T1, T2, T3

**Tests:** TDD `app/src/server/curriculum/deep-agent/bronze-silver-run.test.ts`
for inspect/plan/read/synthesize order, bounded tool calls, JSON schema, page
evidence, and run provenance.

**Artifacts:** Create `app/src/server/curriculum/deep-agent/runner.ts`,
`app/src/server/curriculum/deep-agent/profiles/bronze-to-silver.ts`, and its
test; change `curriculum-promotion-service.ts` and the existing Bronze prompt.

**Reuse:** `curriculum-pi-agent.ts`, temporary Silver storage, and the existing
Bronze approval gate.

**Done when:** Silver derives from agent-requested page evidence, not a full
document payload.

### T5: Run Silver → Gold with no source-reader capability

**Depends on:** T1, T4

**Tests:** TDD `app/src/server/curriculum/deep-agent/silver-gold-run.test.ts`
for approved-Silver-only input, forbidden `read_pages`, matching official text
and source-location validation, and Gold provenance.

**Artifacts:** Create `app/src/server/curriculum/deep-agent/profiles/silver-to-gold.ts`
and its test; change `curriculum-promotion-service.ts`, `curriculum-pi-agent.ts`,
and the Gold prompt.

**Reuse:** existing Gold structured-data validator and SQLite-Vec semantic index
(ADR-0004); use the Engram adapter only for its derived memory/knowledge-graph
projection (ADR-0003).

**Done when:** Gold cannot be generated from raw pages and every record traces
back to approved Silver.

### T6: Surface manifest and run trace to the steward

**Depends on:** T2, T4, T5

**Tests:** Manual QA in `docs/specs/curriculum-deep-agent/notes/manual-qa.md`;
route tests for safe manifest/trace views.

**Artifacts:** Change ingestion status/action routes and
`app/src/app/ingestion/page.tsx`; create manual QA notes. Use existing Shadcn
Card, Button, Badge, and progress components only.

**Reuse:** current desktop ingestion workflow and Shadcn primitives.

**Done when:** The steward can inspect page count, selected pages, stage, and
errors without seeing raw bytes or agent internals.

### T7: Verify the complete local document workflow

**Depends on:** T6

**Tests:** Run lint, typecheck, deterministic tests, production build, a
multi-page PDF manual flow, and an Ollama/Pi integration fixture.

**Artifacts:** Update `docs/specs/curriculum-deep-agent/notes/manual-qa.md`
with observed commands/results; no production artifacts.

**Reuse:** root workspace gates and local Ollama configuration.

**Done when:** A real multi-page source reaches approved Gold with an observed
page-reading trace, structured SQLite-Vec search result, and a separately
observable Engram projection.
