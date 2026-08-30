# RFC-0006 simplification — execution spec

**Status:** Shipped
**Mode:** full (risk triggers: structural change, dependent tasks, security-adjacent deletions)
**Contract of record:** [`docs/rfc/0006-simplify-to-persona-app.md`](../../rfc/0006-simplify-to-persona-app.md) (rev 2, adversarially reviewed; owner approved in session 2026-08-30)

## Objective

Land RFC-0006 phases 1–3 (and 4+ as session health allows) on branch
`simplify/persona-app`: dead-code cut, memory-subsystem cut, and the
JSON-catalog seeder followed by the ingestion/semantic cut — each phase
landing with `pnpm typecheck && pnpm test && pnpm lint` green and its own
commit.

## Boundaries

- No student-, parent-, or admin-visible behavior may change in phases 1–3
  except: the ✨ semantic-search toggle disappears (Phase 3, documented) and
  a fresh database now shows the full topic catalog (Phase 3 seeder — the
  fix, not a regression).
- Learning data (progress, accounts, attempts, assessments) is never
  transformed or deleted. Catalog seeding is additive (upsert by record id;
  extra DB rows are left alone).
- Migrations remain append-only; no migration is edited or removed.
- `@earendil-works/pi-ai` stays. Question generation inside the adaptive
  pool stays.

## Acceptance criteria

- [x] AC1 (Phase 1): `/api/topics`, `/api/achievements`, `/api/generated-question`,
      `/api/parent/chat`, `/api/parent/summary` no longer exist; no code references
      them; the generated-question allowance machinery is gone from `identity.ts`
      and `/api/answer`; PracticePanel carries no test-mode props; gates green.
- [x] AC2 (Phase 2): `server/memory/*` **minus `engram-memory.ts`** (held by
      the ingestion chain until Phase 3b, deleted in Phase 3c), `/api/memory`,
      `/api/knowledge*`, `dashboard/graph` are gone; `/api/answer` writes no
      projections; the admin console has no Knowledge panel; `3d-force-graph`
      removed from deps; gates green.
- [x] AC3 (Phase 3a): an enriched reviewed JSON catalog exists; an idempotent
      seeder loads it into `gold_curriculum_records` at curriculum-DB open; a
      fresh `:memory:` curriculum DB serves the full browse tree; seeder tests green.
- [x] AC4 (Phase 3b/c): ingestion pipeline, semantic search, `sqlite-vec`, gold
      DELETE route + vector-coupled deletes, ✨ toggle, `engram-memory.ts`, the
      engram→gold-semantic chain, `server/curriculum/prompts/`, and the orphaned
      `"promotion"` database kind are gone; text search still works; admin console
      has no Ingestion panel; gates green.
- [x] AC5: every phase is its own conventional commit; `git status` clean at
      each gate.

## Testing strategy

- Per-phase gates: `pnpm lint && pnpm typecheck && pnpm test` (unfiltered).
- AC3 unit tests: fresh-DB seed, idempotent re-seed, extra-row survival.
- Manual QA at each phase: dev server sign-in as `devstu` → answer one
  question → next question renders (recorded in plan notes).
- Integration tests requiring Ollama stay skipped unless `OLLAMA_INTEGRATION=1`
  (already set in the developer's `.env.local`).

## Assumptions

- Owner approval in chat stands for the RFC's open A2UI decision (Phase 4,
  only if reached this session).
- The 728-record local curriculum DB is the dataset of record to export into
  the reviewed JSON (owner's own ingested data).
