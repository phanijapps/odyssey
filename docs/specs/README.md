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
| [curriculum-deep-agent](curriculum-deep-agent/spec.md) | Draft | ADR-0001, ADR-0003, ADR-0004, RFC-0002 | Bounded curriculum-document workflow; successor to curriculum-ingestion |
| [curriculum-model](curriculum-model/spec.md) | Draft | — | Largely delivered by the curriculum modules; spec never passed approval — ratify or rewrite before closing |
| [test-catalog](test-catalog/spec.md) | Draft | RFC-0004 | Green-field governance domain; T1 policy approval is the entry gate |

## Shipped specs

Shipped specs remain as historical feature contracts with their QA records.

| Spec | Status | Constrained by | Notes |
| --- | --- | --- | --- |
| [child-math-practice](child-math-practice/spec.md) | Shipped | ADR-0001, ADR-0002, ADR-0003, RFC-0001 | One-app child practice experience; reconciled 2026-08-17 |
| [test-mode-assessment](test-mode-assessment/spec.md) | Shipped | ADR-0001, ADR-0002, ADR-0003 | Mixed-skill nine-question assessment with completion review |
| [curriculum-ingestion](curriculum-ingestion/spec.md) | Archived | RFC-0002, RFC-0003 | Superseded by curriculum-deep-agent |
| [a2ui-learning-delivery](a2ui-learning-delivery/spec.md) | Shipped | RFC-0004 | Fixed A2UI v0.9.1 catalog for practice, tests, and Performance |
| [performance-guidance](performance-guidance/spec.md) | Shipped | RFC-0004 | Learner Performance page with guidance cards and actions |
| [mistake-to-mastery](mistake-to-mastery/spec.md) | Shipped | RFC-0004 | Test-to-practice remediation projection |
| [engagement-achievements](engagement-achievements/spec.md) | Shipped | — | Practice-only achievements and fun facts |
| [parent-performance-portal](parent-performance-portal/spec.md) | Shipped | RFC-0003, RFC-0004 | Parent relationships, aggregate view, practice preview |

## Adding a new spec

```bash
mkdir -p docs/specs/<feature-name>
cp .agents/skills/new-spec/assets/spec.md docs/specs/<feature-name>/spec.md
cp .agents/skills/new-spec/assets/plan.md docs/specs/<feature-name>/plan.md
```

Or use the `new-spec` workflow in your agent environment.
