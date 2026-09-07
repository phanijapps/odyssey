# Specs

> Feature specifications and implementation plans. See
> [`../CONVENTIONS.md`](../CONVENTIONS.md#4-specs-and-plans--docsspecsfeature)
> for the spec / plan distinction and lifecycle.

Each feature gets a directory:

```
docs/specs/<feature>/
├── spec.md      ← the contract (objective, boundaries, testing strategy, acceptance criteria): what this feature does
├── plan.md      ← the strategy + construction tests: how we'll build it
└── notes/       ← (optional) research, sketches, rejected approaches
```

## Active specs

| Spec | Status | Constrained by | Notes |
| --- | --- | --- | --- |
| [question-atlas-repair](question-atlas-repair/spec.md) | Shipped | Existing practice contracts | Bounded atlas generation, atomic session handoff, answer-driven walking and honest terminal states |
| [curriculum-deep-agent](curriculum-deep-agent/spec.md) | Draft | ADR-0001, ADR-0003, ADR-0004, RFC-0002 | Bounded curriculum-document workflow; successor to curriculum-ingestion |
| [test-catalog](test-catalog/spec.md) | Draft | RFC-0004 | Green-field governance domain; T1 policy approval is the entry gate |

## Shipped specs

Shipped specs remain as historical feature contracts with their QA records.

| Spec | Status | Constrained by | Notes |
| --- | --- | --- | --- |
| [child-math-practice](child-math-practice/spec.md) | Shipped | ADR-0001, ADR-0002, ADR-0003, RFC-0001 | One-app child practice experience; reconciled 2026-08-17 |
| [rfc0006-simplification](rfc0006-simplification/spec.md) | Shipped | RFC-0006 | Phases 1–3: dead code, memory, ingestion, semantic search; JSON catalog seeder |
| [rfc0006-phase4-a2ui](rfc0006-phase4-a2ui/spec.md) | Shipped | RFC-0006 | A2UI → plain validated rendering (interaction renderer, performance report) |
| [rfc0006-phase5-question-path](rfc0006-phase5-question-path/spec.md) | Shipped | RFC-0006 | Single question-selection path; agent as pure completion boundary |
| [repo-professionalization](repo-professionalization/spec.md) | Shipped | RFC-0006 phase 8 groundwork | data/ consolidation, README, env template |
| [practice-engine-package](practice-engine-package/spec.md) | Shipped | RFC-0006 + RFC-0007 | @odyssey/practice-engine extraction, production readiness (bootstrap/backup/export/health) |
| [test-mode-assessment](test-mode-assessment/spec.md) | Shipped | ADR-0001, ADR-0002, ADR-0003 | Mixed-skill nine-question assessment with completion review |
| [curriculum-ingestion](curriculum-ingestion/spec.md) | Archived | RFC-0002, RFC-0003 | Superseded by curriculum-deep-agent |
| [a2ui-learning-delivery](a2ui-learning-delivery/spec.md) | Shipped | RFC-0004 | Fixed A2UI v0.9.1 catalog for practice, tests, and Performance |
| [performance-guidance](performance-guidance/spec.md) | Shipped | RFC-0004 | Learner Performance page with guidance cards and actions |
| [mistake-to-mastery](mistake-to-mastery/spec.md) | Shipped | RFC-0004 | Test-to-practice remediation projection |
| [engagement-achievements](engagement-achievements/spec.md) | Shipped | — | Practice-only achievements and fun facts |
| [parent-performance-portal](parent-performance-portal/spec.md) | Shipped | RFC-0003, RFC-0004 | Parent relationships, aggregate view, practice preview |
| [curriculum-model](curriculum-model/spec.md) | Shipped | — | Post-hoc ratified 2026-08-17; delivered by the curriculum modules |
| [knowledge-graph-3d](knowledge-graph-3d/spec.md) | Shipped | RFC-0003 | Admin 3D force view of the knowledge graph |
| [parent-management](parent-management/spec.md) | Shipped | — | Admin-managed parent accounts, role landing, learner scope-key fix |
| [parent-portal-refresh](parent-portal-refresh/spec.md) | Shipped | — | Portal styling migration, inline account actions, parent-language copy |
| [parent-progress-cards](parent-progress-cards/spec.md) | Shipped | — | Per-child progress cards; performance route returns structured children |
| [parent-practice-recency](parent-practice-recency/spec.md) | Shipped | RFC-0005 | Day-granularity last-practice recency on parent surfaces |
| [parent-suggested-practice](parent-suggested-practice/spec.md) | Shipped | RFC-0005 | Parent suggests a plan skill; child banner accepts into practice |
| [performance-page-styling](performance-page-styling/spec.md) | Shipped | — | Learner /performance migrated off ghost classes; shared narrow-page container |

## Adding a new spec

```bash
mkdir -p docs/specs/<feature-name>
cp .agents/skills/new-spec/assets/spec.md docs/specs/<feature-name>/spec.md
cp .agents/skills/new-spec/assets/plan.md docs/specs/<feature-name>/plan.md
```

Or use the `new-spec` workflow in your agent environment.
