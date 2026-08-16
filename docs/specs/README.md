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
| [child-math-practice](child-math-practice/spec.md) | Implementing | ADR-0001, ADR-0002, ADR-0003, RFC-0001 | Child practice experience |
| [test-mode-assessment](test-mode-assessment/spec.md) | Implementing | ADR-0001, ADR-0002, ADR-0003 | Mixed-skill learner assessment |
| [curriculum-deep-agent](curriculum-deep-agent/spec.md) | Draft | ADR-0001, ADR-0003, ADR-0004, RFC-0002 | Bounded curriculum-document workflow |
| [curriculum-model](curriculum-model/spec.md) | Draft | — | Curriculum records and embeddings |

## Archived specs

Archived specs remain as historical feature contracts.

| Spec | Status | Constrained by | Notes |
| --- | --- | --- | --- |
| [curriculum-ingestion](curriculum-ingestion/spec.md) | Archived | RFC-0002, RFC-0003 | Superseded by curriculum-deep-agent |

## Adding a new spec

```bash
mkdir -p docs/specs/<feature-name>
cp .agents/skills/new-spec/assets/spec.md docs/specs/<feature-name>/spec.md
cp .agents/skills/new-spec/assets/plan.md docs/specs/<feature-name>/plan.md
```

Or use the `new-spec` workflow in your agent environment.
