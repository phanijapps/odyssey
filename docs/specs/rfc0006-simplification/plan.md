# RFC-0006 simplification — execution plan

**Status:** Approved
**Spec:** [`spec.md`](spec.md)
**Rev:** 2 — incorporates pre-EXECUTE review findings 1–9 (ordering split for the
engram→gold-semantic chain, env-gated guarded seeder, keep
`createPracticeAssignmentToken`, e2e posture, test inventories).

## Tasks (waves)

### T1 Phase 1: delete dead routes

Delete routes + tests: `api/topics`, `api/achievements`,
`api/generated-question` (route + `route.test.ts` only — **keep**
`api/answer/standard-scoping.test.ts`; it tests the live answer→progress
on-standard contract), `api/parent/chat`, `api/parent/summary`.
Delete `parent-routes.test.ts` outright (contains only the two 410-stub
cases). Tests: typecheck proves no live importer; remaining suite green.

### T2 Phase 1: unwind allowance machinery

**Keep** `createPracticeAssignmentToken` (live caller `/api/progress`:112).
Delete `grantGeneratedPracticeAllowance`, `consumeGeneratedPracticeAllowance`,
`issueGeneratedPracticeAssignment` from `identity.ts`; drop the grant call +
imports in `api/answer`; delete the allowance test block + imports in
`identity.test.ts` (:6-7, :141-151). `auth_sessions` columns wither in place.
Tests: answer-route tests updated to assert no allowance side effects.

### T3 Phase 1: drop vestigial PracticePanel test-mode props

Remove `testDone/testLog/testScore/onStartNewTest` + report block from
`practice-panel.tsx` (:26-28,33,96-119) and the pass-through state from
`page.tsx` (:88-93,1026-1033). Manual QA practice flow.

### T4 Phase 2: delete memory subsystem (minus engram-memory)

Delete `server/memory/knowledge-graph*.ts(+tests)` and `server/memory/
engram-memory.test.ts` + `engram-native.integration.test.ts`, `api/memory`,
`api/knowledge(+graph)`, `dashboard/graph/page.tsx`; strip projection writes

- imports from `api/answer` (:11-20,66-90,98-107,133-134).
  **Keep** `server/memory/engram-memory.ts` — still imported by
  `engram-curriculum-graph.ts` → `gold-semantic-index.ts` → ingestion actions
  route (dies in T7); it is deleted in T8. `agent.test.ts` keeps its import
  until T8.

### T5 Phase 2: admin console + dependency cleanup

Strip Knowledge panel + nav + graph link from `dashboard/page.tsx`
(:446-463,850-856); remove `3d-force-graph` from `app/package.json`; clean
Engram vars from root `.env.example`; remove the Engram-disarm env lines from
`app/playwright.config.ts` (`ODYSSEY_ENGRAM_ARTIFACT`, `ENGRAM_APPROVED_ROOT`)
in T4 instead if the config imports break earlier. Dead CSS (`.semantic-btn`,
`.graph3d-*`, `.kg-edge`) explicitly deferred → `workspace.toml` backlog
entry (surface-cleanup pass). Manual QA console.

### T6 Phase 3a: reviewed JSON catalog + guarded idempotent seeder

Export 728 gold records from `app/odyssey-curriculum.db` to
`server/curriculum/data/ohio-catalog.json` (enriched content_json shape).
Add `seedCatalogFromJson(db)` (pure, idempotent upsert by `record_id` —
`sqlite-queries.json` already has `upsertGoldRecord`) + a one-row
`catalog_seed_meta` guard table (content hash) so steady-state open cost is
one SELECT; hook it into `openDatabase(kind==="curriculum")` after migration
— **not** a Next.js instrumentation hook (e2e global-setup lazy-open
invariant). Gate with `ODYSSEY_SEED_CATALOG` (default on; `"0"` disables);
set `"0"` in `src/test/sqlite-isolation.setup.ts` (process-wide) so existing
empty-DB fixtures (search/progress/performance/mistake-to-mastery/gold-query
tests) keep exact contents. TDD: fresh `:memory:` DB + explicit seed → full
browse tree; re-run stable (hash guard); extra DB row survives re-seed;
`ODYSSEY_SEED_CATALOG=0` → no-op. e2e: set posture in `playwright.config.ts`
(seed off keeps current assertions; record deviation from RFC's "migrate
e2e to seeder" if we keep raw-SQL seeding — deliverable noted per RFC).

### T7 Phase 3b: delete ingestion pipeline (+ its engram chain)

Delete `promotion-store`, `promotion-workflow`, `curriculum-promotion-service`,
`source-importer`, `curriculum-pi-agent`, `curriculum-indexer`,
`engram-curriculum-graph.ts`, `gold-semantic-index.ts` (+ all their tests),
`server/curriculum/prompts/`, `api/curriculum/ingestions*`,
`ingestion/page.tsx`, admin Ingestion panel (`dashboard/page.tsx:153-156,243+`),
and the orphaned `"promotion"` `DatabaseKind` branch in
`persistence/sqlite.ts` (`DatabaseKind` type + promotion ternary in
`resolveDatabasePath` — sole caller dies here).

### T8 Phase 3c: delete semantic search + gold deletes (+ engram-memory)

Delete `vector-repository`, `ollama-embeddings` (+tests),
`server/memory/engram-memory.ts` (+ remaining test imports, incl.
`agent.test.ts` `parseRetrievedProfileMemory`), `sqlite-vec` dep, semantic
branch in `search/route.ts` (:3-4,77,97+), gold `DELETE` handler
(`gold/route.ts:60`) + vector-coupled deletes in `gold-query.ts` (:187-230),
✨ toggle (`learner-header.tsx:87-94,111`) + `semanticSearch`
(`page.tsx:264-271,932,955`), orphaned `allowExtension` loading in `persistence/sqlite.ts` (openDatabase
options). Rewrite `search/route.test.ts` to assert
the text-only contract (fixture matches; no `semantic` param/branch).

### T9 Phase 4 (stretch): replace A2UI

Plain interaction renderer from zod-validated payloads; delete `src/a2ui/*`,
surface wrappers, `@a2ui/*` deps. Manual QA practice + test flows.

## Verification modes

- TDD: T6. Goal-based checks: all deletion tasks (`Done when:` gates +
  grep zero-references). Manual QA: practice flow after T3; admin console
  after T5; fresh-DB browse after T6.

## Constraints

- One commit per phase; gates unfiltered before each commit.
- No migration edits; catalog seeding additive-only; `catalog_seed_meta` is
  a new migration (append-only, v12).
- Deferred finds → `workspace.toml` backlog entries, not scope creep.

## Risks

- e2e posture under seeding — resolved by explicit `ODYSSEY_SEED_CATALOG`
  posture in `playwright.config.ts` (T6).
- `pnpm test` runtime growth from JSON parse at import — export file loaded
  lazily inside the seeder only.
