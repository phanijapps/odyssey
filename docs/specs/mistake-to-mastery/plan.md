# Plan: Mistake-to-Mastery

- **Spec:** [`spec.md`](spec.md)
- **Status:** Executing

## Approach

Build one focused read model over authoritative assessment snapshots and
redacted Practice attempts. Keep plan computation deterministic and ephemeral:
the service derives targets, baseline evidence, post-baseline evidence, and
child-safe explanation templates on each request. The first delivery adds a
learner-scoped BFF endpoint and a small action card; it does not create a new
mastery engine, prerequisite traversal, parent role, or generative coach.

## Constraints

- Preserve server-issued assignment and learner-scope boundaries.
- Preserve the current Test/Practice separation.
- Reuse Gold snapshot identity/fingerprint; do not parse client composite IDs.
- The learner-only read model follows RFC-0004’s local snapshot and isolation policy; production/catalog policy remains out of scope.

## Construction tests

**Integration tests:** completed/partial/none source selection; Gold snapshot
stability; target grouping; post-baseline filtering; endpoint redaction,
learner isolation, and no-store; Practice action target validation.

**Manual verification:** complete a Test with a missed standard, open
Performance, start its Practice action, answer normally, reload Performance,
and confirm only the checkpoint changes.

## Design (LLD)

### Data & schema

No v1 plan table exists. The read model joins terminal `test_sessions` and
`test_questions` with their snapshot metadata, then aggregates
`learning_attempts` where timestamp is after the completed assessment. The
canonical target key is built server-side from snapshot subject/grade/domain/
standard code through one validated helper.

### Interfaces & contracts

A learner-only `GET /api/performance/plan` returns a capped DTO with source
assessment date, target standard projection, baseline counts, post-baseline
counts, state, explanation, and validated Practice action target. It rejects
client-selected learner and assessment IDs. The final contract is authored
before route implementation.

### Component / module decomposition

- `server/learning/mistake-to-mastery.ts`: pure classification and focused
  repository read model.
- Performance route adapter: authentication, response validation, no-store.
- learner guidance card: renders fixed text/action from the DTO only.

### Behavior & rules

Use most recent completed Test. Group each missed Gold record once. State is
`recommended` with zero later matching attempts, `practicing` with one or more,
and checkpoint-met at the approved threshold. Empty/no-error results use a
positive neutral state. The plan never orders by prerequisites in v1.

### Failure, edge cases & resilience

Malformed legacy snapshots yield a safe omitted target plus observability, never
a client error or alternate live-Gold substitution. The card has loading,
empty, retryable-error, and action-failure states. A deleted current Gold record
can show history/evidence but disables Practice with an honest unavailable
state.

### Quality attributes (NFRs)

Cap returned items and activity counts. Compute only parameterized,
learner-scoped reads. Meet the existing UI keyboard/focus/error-state standard.

## Tasks

### T1: Freeze the plan contract and evidence policy

**Status:** Complete. The plan is learner-only, selects the latest completed Test, uses a three-correct-attempt checkpoint, and has no parent/Pi/persistence/action surface.

**Depends on:** none

**Tests:** no stub (contract/design review); table-driven examples cover no
completed Test, partial-only history, missed standard, later Gold edit, and
post-test practice.

**Approach:** approve checkpoint threshold, freshness wording, source-selection
rule, DTO, action target, and redaction policy; add contract fixture examples.

### T2: Make plan classification a pure tested module

**Status:** Complete. The read model groups snapshot standards, excludes malformed data and partial Tests, caps items, and counts only later correct Practice attempts.

**Depends on:** T1

**Touches:** `app/src/server/learning/mistake-to-mastery.*`

**Tests:** red-green-refactor for grouping, target mapping, post-baseline
filtering, state thresholds, caps, and empty state.

**Approach:** introduce named domain types and an explicit server-side target
builder; no generic analytics abstraction.

### T3: Expose the learner-scoped redacted plan

**Status:** Complete. `GET /api/performance/plan` derives learner scope from the session and returns a no-store redacted DTO.

**Depends on:** T2

**Touches:** `app/src/app/api/performance/plan/*`, `app/src/server/learning/*`

**Tests:** route integration tests for authentication, cross-child rejection,
partial exclusion, no-store, redaction, and unavailable target behavior.

**Approach:** add the thin route adapter and parameterized repository query.

### T4: Add the child guidance entry point

**Status:** Complete. The Performance surface renders one fixed guidance card
per plan item with evidence-stating text and, when the target is still
reviewed, a `performance.practice` action that enters the existing Practice
flow for exactly that standard. Verified by the
`performance-guidance` browser journey.

**Depends on:** T3

**Touches:** `app/src/app/learner/*`, `app/src/app/performance/*`

**Tests:** manual happy path plus component/state tests supported by the test
harness; confirm action enters current Practice flow without a new generator.

**Approach:** render one fixed guidance card with explicit evidence and action.

### T5: Verify Test/Practice isolation end-to-end

**Status:** Complete. `app/src/app/api/performance/read-isolation.test.ts`
snapshots the progress, attempt, and Test tables plus the session-bound
adaptive question pool across Performance and plan reads and proves no
mutation; the app gates, the Playwright browser journey, and the dependency
audit are green.

**Depends on:** T3, T4

**Tests:** integration regression proves plan reads never mutate progress,
learning attempts, memory, graph, assessment records, or assignment state.

**Approach:** run full app gates and record manual QA evidence.

## Risks

- Snapshot-to-practice target mapping can drift; mitigate with one validated
  server helper and regression fixtures.
- A checkpoint may be over-interpreted; mitigate with explicit language and no
  mastery label.
- Parent sharing is privacy-sensitive; exclude it until a dedicated spec.

## Changelog

- 2026-08-16: Drafted from Performance/Test Catalog research.
- 2026-08-17: Implemented the deterministic learner-only read model and BFF; action entry remains in progress.
- 2026-08-17: Delivered the guidance card action entry and the read-isolation
  regression; the plan is feature-complete.
