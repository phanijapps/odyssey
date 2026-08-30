# RFC-0006: Simplify to a three-persona local application

- **Status:** Draft (rev 2 — incorporates adversarial review findings 1–9)
- **Date:** 2026-08-30
- **Supersedes (in part):** ADR-0001 (A2UI runtime dependency), RFC-0002 (curriculum source promotion), `docs/product/briefs/child-math-learning.md` (parent-portal deferral; A2UI catalog wording)
- **Withdraws:** `docs/specs/curriculum-deep-agent` (Draft), `docs/specs/test-catalog` (Draft, ingestion-dependent)

## Decision

Collapse Odyssey from an over-built curriculum platform back into the
product the brief describes: **one simple, local-first child math practice
application with exactly three personas — Student, Parent, and Admin.**

Concretely:

1. **Keep the three-role identity model as-is** (`admin` | `parent` |
   `student`, scrypt auth, parent↔child links). It is sound and already
   matches the persona goal.
2. **Cut every beyond-MVP subsystem** that no persona screen needs:
   engram memory + knowledge graph, semantic search (vector index +
   embeddings), the Bronze→Silver→Gold ingestion pipeline, and the
   dead/unwired routes.
3. **Replace A2UI** with a small plain-React interaction renderer fed by
   zod-validated server payloads — preserving the guardrail's *spirit*
   (validated, constrained component catalog) while dropping the
   `@a2ui` machinery. *This is a brief amendment requiring owner
   sign-off; see Alternatives.*
4. **Make the versioned JSON catalog the only curriculum source — as new
   seeding work.** Today the student browse tree reads Gold records from
   the local curriculum DB, and the **only** runtime writer of those
   records is the ingestion pipeline; the DB files are not git-tracked,
   so a fresh clone has an **empty catalog** (practice and test cannot
   start). This RFC replaces that writer with an idempotent
   startup seeder that loads an **enriched, reviewed JSON catalog**
   (schema extended to carry `subject`, `domain`, `cluster`,
   `standardCode`, `standardText`, `source` per record — the current
   `data/topics.json` lacks these fields) into `gold_curriculum_records`,
   keeping the existing read path (`browse.ts`, `gold-query.ts`,
   `assessment.ts` topic selection) untouched. The one-time export of
   the current local 728-record dataset into that reviewed JSON is part
   of this work.
5. **Rebuild the three persona surfaces** as focused screens (Student
   app, Parent dashboard, Admin console) with mockups in
   [`0006-notes/mockups/`](0006-notes/mockups/) as the target.

## Motivation

The repository carries ~16,000 lines of non-test code for what the brief
defines as a focused MVP. Three parallel scout reports plus direct audit
found:

- **~5,500+ LOC of beyond-brief machinery**: memory projections
  (~2,000), ingestion + semantic search (~2,000), parallel
  question-selection paths (~900 overlapping), A2UI indirection
  (~1,700 incl. server document builders and two near-duplicate
  234-line surface wrappers).
- **Dead code**: `/api/topics`, `/api/achievements`, and
  `/api/generated-question` have **no UI callers**; `/api/parent/chat`
  and `/api/parent/summary` are 410-Gone stubs; the generated-question
  *allowance* machinery writes state nothing consumes.
- **A 1,046-line student god-component** mixing auth, search, practice,
  test mode, and suggestion concerns; a 1,118-line admin console whose
  majority surface (ingestion, knowledge graph) exists to feed
  subsystems this RFC removes.
- **Three SQLite databases** on disk (learning, curriculum,
  knowledge-graph) and **~20 environment variables** across Ollama
  embeddings, Engram, and curriculum paths — to run a local math
  practice app. Worse: because the catalog lives only in untracked DBs
  fed by ingestion, **a fresh clone cannot serve a single practice
  question** — the "platform" undermined its own MVP.

The user-facing goal is a simple, usable, three-persona application.
Everything above works against that goal.

## Proposal

### Target application shape

```text
Persona   Route      Screens
Student   /          sign-in → pick skill → practice (one question at a time)
                     assessment (test mode) → results
                     performance (mastery per skill)
Parent    /parent    child cards (aggregate progress, streaks) → suggest
                     practice, child account management (create/reset/revoke)
Admin     /admin     accounts (parents; create/reset),
                     curriculum catalog (browse seeded JSON catalog, coverage),
                     question bank (per-standard coverage), system health
```

### Subsystem dispositions

| Subsystem | Disposition | Rationale |
| --- | --- | --- |
| `server/memory/*` (engram adapter, knowledge graph) + `/api/memory`, `/api/knowledge*`, `dashboard/graph` | **Cut** (~2,000 LOC + 3rd DB + `3d-force-graph` dep) | Brief defers the engram adapter explicitly; graph is an admin diagnostic; answer-route projection writes are best-effort and unused by any screen. |
| `vector-repository`, `gold-semantic-index`, `ollama-embeddings`, `sqlite-vec` dep | **Cut** (~400 LOC + dep) | Only serves the student `✨` semantic search toggle and gold-delete index cleanup; text search fallback already exists. The cut **also removes**: the `DELETE` handler on `/api/curriculum/gold` and the vector-coupled delete functions in `gold-query.ts` (kept code imports the cut module today), the semantic branch/imports of the search route, and the `✨` toggle (`learner-header.tsx`) + `semanticSearch()` (`page.tsx`). |
| `promotion-*`, `source-importer`, `curriculum-pi-agent`, `curriculum-indexer`, `/api/curriculum/ingestions*`, `ingestion/page.tsx` | **Cut** (~1,500 LOC) — **after** the JSON seeder ships | Ingestion is currently the only Gold writer; the seeder (Decision §4) replaces it. LLM-driven standards authoring is out of scope for a simple app. |
| A2UI (`src/a2ui/*`, 3 surface wrappers, `@a2ui/*` deps, A2UI docs in routes) | **Replace** with plain interaction renderer (~150 LOC) | Functionally renders text / multiple-choice / true-false interactions. Guardrail preserved via zod-validated payloads; ~1,700 LOC and 2 deps removed. **Needs sign-off** (amends brief wording). |
| `/api/topics`, `/api/achievements`, `/api/generated-question`, `/api/parent/chat`, `/api/parent/summary`, allowance machinery | **Cut** | Zero UI callers; 410 stubs; allowance state nothing consumes. Cutting the allowance also removes the grant call in `/api/answer` and the grant/consume helpers in `identity.ts`; the `auth_sessions.generated_requests`/`allowance_topic` columns wither in place (no migration). `achievements.ts` module stays (feeds performance docs). |
| `adaptive-pool` + `agent` + `question-bank` | **Consolidate** to one path | Two overlapping selection systems. Keep adaptive-pool as the engine; `agent.ts` remains the bounded Ollama completion+validation boundary used *internally* by the pool (bank-first with optional generation fallback — matches brief). `@earendil-works/pi-ai` **is retained** (it is the completion boundary). |
| `parent-suggestions`, `mistake-to-mastery`, `parent-performance`, `parent-preview` | **Keep as-is** | They are the parent persona's actual value. The parent surface stays aggregate-safe; per-skill level detail for parents is a *possible* future extension, not part of this RFC. |
| Assessment (test mode), suggested-practice banner, achievements/fun-facts in performance docs | **Keep** | Working, tested, persona-relevant. |
| Identity (roles, links, sessions) | **Keep as-is** | Sound foundation; matches the 3-persona goal. SSO stub (`resolveExternalIdentitySubject`) cut in a later pass. |
| Databases | **Two → one** (optional final step, with data cutover) | Learning + curriculum merge into `odyssey.db`; the knowledge-graph DB disappears with the memory cut. Cutover copies `gold_curriculum_records` rows into the merged file, keeps `ODYSSEY_DB_PATH` as the single knob, and accepts legacy tables remaining (dropping them would require kind-aware migrations on both existing files). |

### Phases

Ordered; later phases build on earlier ones. Gates for every phase:
`pnpm typecheck && pnpm test && pnpm lint`. Each phase lists the tests it
deletes or updates — "lands green" is checkable.

1. **Dead-code cut** — delete `/api/topics`, `/api/achievements`,
   `/api/generated-question`, `/api/parent/chat`, `/api/parent/summary`
   and their route tests; remove the allowance grant call in
   `/api/answer`, the grant/consume/issue helpers in `identity.ts`, and
   the vestigial test-mode props in `PracticePanel`. *Tests:* delete the
   five route test files; fold the answer-route allowance assertions
   (currently in `generated-question/route.test.ts`) into
   `answer/route.test.ts` expectations, which must now show no grant
   side effects.
2. **Memory cut** (requires Phase 1 — `/api/generated-question` imports
   `engram-memory`) — remove `server/memory/*`, `/api/memory`,
   `/api/knowledge*`, `dashboard/graph/page.tsx`, the `3d-force-graph`
   dep, and the projection writes in `/api/answer`; strip the Knowledge
   panel from `dashboard/page.tsx` (kept file). *Tests:* delete memory
   + knowledge-route tests; update `agent.test.ts` (imports
   `parseRetrievedProfileMemory`) and `answer/route.test.ts` projection
   assertions.
3. **Seeder + ingestion/semantic cut** — **first** add the enriched
   reviewed JSON catalog and the idempotent startup seeder into
   `gold_curriculum_records` (with tests, and a one-time export of the
   current local dataset into the JSON); **then** remove the ingestion
   pipeline, semantic search (`vector-repository`,
   `gold-semantic-index`, `ollama-embeddings`, `sqlite-vec`), the
   `DELETE` handler on `/api/curriculum/gold` and vector-coupled
   deletes in `gold-query.ts`, the search route's semantic branch, the
   `✨` toggle + `semanticSearch()`, `ingestion/page.tsx`, and the
   Ingestion panel from `dashboard/page.tsx`. *Tests:* delete
   ingestion/embedding/vector tests; rewrite
   `curriculum/search/route.test.ts` (currently imports
   `deleteGoldRecord` + vector repo); add seeder tests; update e2e
   `performance-guidance.spec.ts` (seeds Gold by raw SQL today) to the
   seeder.
4. **A2UI replacement** — plain `QuestionInteraction` renderer +
   zod-validated payloads; drop `@a2ui/react` + `@a2ui/web_core`;
   delete the duplicate surface wrappers. *Tests:* the existing zod
   document schemas become contract tests for the new renderer.
5. **Question-path consolidation** — one selection path (adaptive pool
   with optional validated generation fallback); retire the overlapping
   half of `agent.ts`/`question-bank.ts` surface.
6. **Persona surface rebuild** — split `page.tsx` into focused student
   screens; rebuild the admin console (accounts / catalog+coverage /
   health) from the mockups; keep the parent page aggregate-safe (its
   mockup's per-skill "focus areas" come from the *existing*
   suggestions read model — no new parent data surface). Admin child
   unlink stays parent-side; the admin console manages parents (and
   reads children) only.
7. **Consolidation** (optional) — single DB with the cutover described
   above; docs refresh (`architecture/`, route table, changelog,
   `workspace.toml`), spec reconciliation (withdraw
   `curriculum-deep-agent`, `test-catalog`), delete the root-level
   stale `odyssey-*.db` leftovers (untracked).

### Route inventory after simplification

`/api/session` (GET/POST/DELETE), `/api/progress`, `/api/answer`,
`/api/test*`, `/api/performance`, `/api/suggested-practice*`,
`/api/curriculum/browse`, `/api/curriculum/search` (text only),
`/api/curriculum/gold` (admin catalog reads — no DELETE),
`/api/parent/children*`, `/api/parent/performance`,
`/api/parent/preview`, `/api/parent/children/*/suggestions`,
`/api/admin/parents*`.

## Alternatives considered

- **Keep A2UI** (brief-literal): preserves the letter of the brief's
  "small, validated A2UI component catalog" guardrail; costs ~1,700 LOC,
  two deps, and near-duplicate surface wrappers to render a radio group.
  Rejected for a *simple* app, but this RFC defers to the owner — if
  A2UI alignment matters strategically (e.g. multi-client agent UIs
  later), Phase 4 can be skipped at the cost of the simplification goal.
- **Cut the parent persona** (brief-literal: parent portal is
  deferred): rejected — the owner explicitly wants three personas, and
  the parent surface already exists, works, and is tested.
- **Keep ingestion for future curriculum growth**: the JSON catalog +
  seeder already maps topics to Ohio standards and makes fresh clones
  work; LLM standards authoring can return behind a future RFC if the
  catalog outgrows hand-editing.
- **Read the JSON directly instead of seeding the DB**: would remove
  the curriculum DB from the read path entirely, but rewrites
  `browse.ts`/`gold-query.ts`/assessment selection at once. Rejected
  for now — the seeder keeps the read path (and its tests) untouched;
  the direct-read variant can be Phase 7+ work if the DB merge lands.
- **Big-bang rewrite**: rejected — the healthy core (identity,
  adaptive practice, assessment, parent projections) is worth keeping;
  strangler-style phase cuts keep tests green throughout.

## Consequences

- ~5,500–6,500 LOC and four runtime deps (`@a2ui/react`,
  `@a2ui/web_core`, `sqlite-vec`, `3d-force-graph`) removed;
  `@earendil-works/pi-ai` retained as the generation boundary. Env
  surface shrinks to DB path + optional Ollama completion config +
  parent bootstrap.
- The admin persona changes from "curriculum steward" to "operator"
  (accounts + catalog + bank + health). Bronze/Silver/Gold vocabulary
  disappears from the runtime; historical ADRs/RFCs remain as records.
- Amends the product brief: parent portal becomes in-scope (already
  built), A2UI catalog wording becomes "validated interaction payloads".
- Fresh clones become usable immediately: the catalog arrives as a
  reviewed JSON file seeded at startup — no ingestion ceremony.
- Phases are ordered, not independent: 2 needs 1 (engram import), 3
  needs the seeder before the ingestion cut, and 2/3 each strip their
  panels from the admin console. A phase can still halt without
  stranding later ones, but earlier ones must land first.
- Risks: A2UI replacement touches the practice/assessment render path
  (mitigated by the existing zod schemas becoming the contract tests);
  the seeder must be idempotent and reviewed (it becomes the catalog's
  source of truth alongside the JSON); DB merge (Phase 7) must copy
  Gold rows rather than assume empty state, or existing local accounts
  and progress — the app's core local-first value — are orphaned.
