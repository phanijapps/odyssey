# Plan: test mode assessment

- **Spec:** [`spec.md`](spec.md)
- **Status:** Done

> **Plan contract:** this is the implementation strategy. It changes only with
> the spec when implementation discovers a contract mismatch.

## Approach

Keep Practice on its existing adaptive pool and build an explicit,
server-owned assessment model for Test. A compact persisted test session records
the selected Gold record IDs, fixed ordinals, assigned difficulty, retained
validated question payload, attribution metadata, answer state, and calculated
points. A focused repository/service permits one active test per learner and
uses atomic creation and assignment preparation leases; routes expose only safe projections
of the active server assignment. The existing page gains an intentional setup,
assessment, and result flow while sharing math rendering and validated
generation. Test creation resolves selected Gold records once; advancement
obtains only the current/next assignment rather than rescanning or generating
all nine.

## Constraints

- Conforms to ADR-0001, ADR-0002, ADR-0003 and
  `docs/architecture/reference.md`.
- Reuses the existing server-only Pi adapter; no new Pi extension, MCP,
  subagent, provider, tool, or dependency is introduced.
- Keeps test answers separate from practice progress, profile memory, and
  knowledge-graph mastery signals.

## Construction tests

**Integration tests:** authenticated test creation, server-owned submission,
resume after a route reload, duplicate-submission idempotency, completion score,
and practice/test persistence isolation against a temporary SQLite database.

**Manual verification:** start the application, select multiple skills in Test,
refresh mid-test, complete it without formative disclosure, inspect the 180-point
result, then switch to Practice and observe immediate tutoring feedback. Record
the observed flow in `docs/specs/test-mode-assessment/notes/manual-qa.md`.

## Design (LLD)

### Design decisions

A test is a persisted assessment session rather than a `question_pool` mode.
This prevents practice state from being visually relabelled as a test and makes
score, resume, and answer binding server-authoritative. The existing adaptive
pool remains the single Practice implementation. Traces to: AC 1–6.

### Data & schema

SQLite owns `test_sessions`, `test_questions`, and test-attempt/result data.
A test session belongs to one learner and contains a normalized immutable
selection snapshot (Gold record ID, subject, grade, standard content, and content
fingerprint), status, score, and timestamps; a partial unique index permits one
active session per learner. Start resumes that session or atomically creates it. Each ordinal
has a unique `(test_session_id, ordinal)` assignment and separately stores Gold
record ID, Gold content fingerprint, generator content version,
validation-schema version, validation outcome, planned difficulty, retained
question payload, grading fields, and points. Preparation uses a durable
`preparing` lease with conditional finalization to `ready`; an expired or failed
lease becomes retryable while a finalized assignment is never replaced. Each
finalized question stores an exact-text hash with a session-scoped unique index,
so a collision regenerates or returns unavailable. Index
learner/status and session/ordinal queries. Raw learner answer text is never
stored. Traces to: AC 2–7.

### Interfaces & contracts

Private same-origin route handlers accept only a bounded `standardIds` start
request and an answer for the server-resolved active test question. A repository resolver uses the Gold table's `record_id` primary-key lookup to
verify each opaque ID is a current reviewed Gold math record and that the ordered
selection shares subject and grade; it persists an immutable resolved-content
snapshot for later advancement. Assessment reads and mutations require the learner
role. Every mutation applies a strengthened shared identity guard that compares the
Origin to the configured canonical application origin before reading or writing.
Responses use a pre-completion display
projection that omits answer keys, hints, solutions, correctness, and points;
completed-result reads remain learner scoped. No client-provided topic, question,
difficulty, points, or answer key is accepted. No external or published interface
is introduced. Traces to: AC 2–7.

### Component / module decomposition

A focused assessment repository/service owns persistence, allocation, grading,
and safe response shapes. `adaptive-pool.ts` retains reusable question generation
and receives a selected standard for each assignment. `page.tsx` owns setup,
active, resume, and result states, with small same-file UI components only when
more than one caller needs them. Traces to: AC 1–9.

### State & control flow

Test setup validates ordered unique Gold IDs and atomically creates or returns
the learner's one active session. Each ordinal rotates through that order,
follows the fixed difficulty plan, and leases then finalizes one validated question
before display. A failed or expired current-assignment lease exposes a retry state
without advancing; a finalized question is never replaced. Submission grades the current unanswered ordinal
transactionally;
duplicate retries return only the safe active state until completion. The next
transition fetches or prefetches only the next ordinal. Completion freezes the
score and exposes answer/solution review only then. Practice mode never accesses
test state. Traces to: AC 2–8.

### Behavior & rules

Test has no formative answer disclosure. Practice continues to adapt immediately.
The active test locks subject, grade, mode, and selected skills. Selection is
capped at three approved Gold records and test score uses 10/20/30 points by
planned level. Exact duplicate question text is rejected within an assessment.
Traces to: AC 1–7, 9.

### Failure, edge cases & resilience

Reject invalid selections before creation and expose a non-sensitive unavailable
state when an assigned question cannot be generated. Transactional persistence
prevents duplicate answers and concurrent score changes. Retained question data
makes refresh/resume stable. Prefetch failure never changes the assessment
state. Traces to: AC 3–8.

### Quality attributes (NFRs)

Test setup and status are keyboard-operable with visible focus. Tests instrument
one selected-record resolution at creation, zero full-curriculum scans on
advancement, at most current-plus-next concurrently preparing or unrevealed
assignments, retention of every finalized question, and one retained question
under concurrent prefetch. Test start and next-step loading expose an
honest loading state instead of a blank question. Traces to: AC 8–9.

### Dependencies & integration

The existing SQLite, curriculum browsing, validated generator, identity service,
and MathText rendering are reused. No dependency or agent-capability change is
part of this plan. Traces to: AC 1–9.

## Tasks

### T1: Persist server-owned assessment lifecycle

**Depends on:** none

**Touches:** `app/src/server/learning/sqlite-repository.ts`,
`app/src/server/learning/assessment.ts`, `app/src/server/learning/assessment.test.ts`,
`app/src/server/curriculum/gold-query.ts`, `app/src/server/curriculum/gold-query.test.ts`

**Tests:**

- TDD: one-to-three ordered, unique Gold record IDs from one subject/grade
  allocate nine ordinals round-robin with `1,1,1,2,2,2,3,3,3`; foreign,
  duplicate-ID, cross-grade, and unavailable IDs are rejected (AC 2, 7).
- TDD: direct selected-ID resolution binds `record_id`, subject, grade, reviewed
  content, and its fingerprint without a browse-tree scan (AC 2, 8).
- TDD: concurrent learner-role starts create or return exactly one active session;
  non-learner sessions are rejected, and concurrent ordinal preparation
  conditionally claims one record (AC 2, 4).
- TDD: the immutable selected-record snapshot survives Gold edits/removal during
  an active test (AC 2, 8).
- TDD: an answer can grade only the active ungraded ordinal, duplicate submission
  is idempotent and opaque before completion, score is server-calculated, and
  completion is immutable (AC 3–5).
- TDD: assessment records do not update practice progress or learning attempts
  (AC 6).

**Approach:**

- Add a primary-key Gold-record resolver plus narrow assessment tables,
  partial/unique indexes, typed repository operations, and a service that
  resolves Gold IDs once, owns atomic start/allocation/preparation leases, and
  transactionally grades retained questions without raw learner answers.
- Materialize red TDD stubs before production code.

**Done when:** assessment lifecycle tests cover allocation, authorization scope,
idempotency, score, resume, completion, and Practice isolation.

### T2: Bind retained questions to assessment assignments

**Depends on:** T1

**Touches:** `app/src/server/agent/adaptive-pool.ts`,
`app/src/server/agent/adaptive-pool.test.ts`, `app/src/server/learning/assessment.ts`

**Tests:**

- TDD: every generated/retained assessment question separately includes the
  assignment's Gold record ID, Gold content fingerprint, generator content
  version, validation-schema version, validation outcome, and planned difficulty;
  a generator fallback cannot silently use a different selected standard (AC 2, 7).
- TDD: malformed or unsafe generated payloads are rejected before persistence;
  failed/expired current-assignment leases become retryable without advancement,
  concurrent retries preserve one finalized retained question, and concurrent
  exact-text collisions are regenerated or unavailable (AC 4, 8).

**Approach:**

- Reuse the validated question generator with explicit selected Gold-record
  input and persist its attribution metadata.
- Generate only an unprepared current assignment and best-effort prefetch at
  most the next; lease, validate, and conditionally finalize a question before
  returning any display projection.

**Done when:** generator and assessment tests prove topic/difficulty binding and
stable retained-question reuse.

### T3: Expose authenticated test routes without weakening Practice

**Depends on:** T1, T2

**Touches:** `app/src/app/api/test/route.ts`,
`app/src/app/api/test/route.test.ts`, `app/src/app/api/test/answer/route.ts`,
`app/src/app/api/test/answer/route.test.ts`, `app/src/app/api/progress/route.ts`,
`app/src/app/api/answer/route.ts`, `app/src/server/identity/identity.ts`,
`app/src/server/identity/identity.test.ts`

**Tests:**

- TDD/integration: an authenticated learner can start, resume, advance, answer,
  and complete only their test; non-learner, anonymous, missing, cross-port, or
  foreign-Origin, malformed, oversized, unknown-field, foreign, duplicate, and
  client-topic/score injection requests fail safely (AC 3–7).
- TDD/integration: active-state, answer, and duplicate-answer DTOs omit
  answer/hint/solution/correctness/points until completion; cross-learner result
  reads fail, while existing Practice response behavior remains immediate (AC 1,
  3).

**Approach:**

- Strengthen the shared mutation proof to compare the Origin against a configured
  canonical application origin (with an explicit test-only allowance), then add
  focused same-origin start/state and answer routes that use the assessment service.
- Remove Test handling from the mutable Practice pool route/answer path; keep
  their public behavior practice-only and fix the stale mode-closure request
  path through the new explicit test start action.

**Done when:** route tests prove the full server-owned test lifecycle and
practice/test disclosure and persistence separation.

### T4: Make the learner's mode choice and test flow explicit

**Depends on:** T3

**Touches:** `app/src/app/page.tsx`, `app/src/app/styles.css`

**Tests:**

- Visual/manual QA: the real page makes Practice tutoring and Test setup,
  active, loading, resume, unavailable, completion, and exit states distinct;
  keyboard focus and controls remain usable (AC 1, 5, 9).
- Goal-based check: `pnpm --dir app build` succeeds and the page typechecks
  against the server response shapes (AC 1–9).

**Approach:**

- Keep the compact mode control, but send Practice directly to a selected skill
  and require Test selections before a server start request.
- Lock test-changing controls while active, avoid stale state closures, and
  render only permitted feedback at each assessment state.

**Done when:** a manual browser journey completes a mixed-skill test, reloads
mid-test, and returns to unchanged Practice tutoring.

### T5: Verify performance and clean up the retired shared test path

**Depends on:** T2-T4

**Touches:** `app/src/server/agent/adaptive-pool.ts`,
`app/src/server/identity/identity.ts`, `app/src/app/api/progress/route.ts`,
`app/src/app/api/answer/route.ts`, relevant tests, `docs/specs/test-mode-assessment/notes/manual-qa.md`

**Tests:**

- TDD: duplicate prefetch work cannot overwrite or duplicate a finalized test
  assignment; failed/expired leases can recover, exact-text collisions are not
  finalized, and instrumentation proves one selected-record resolution at
  creation, no full-curriculum scan on advance, and no more than current-plus-next
  concurrently preparing or unrevealed assignments (AC 4, 8).
- Goal-based: search confirms no Test route depends on the legacy session pool,
  and `pnpm --dir app test` passes (AC 1–8).
- Visual/manual QA: record observed first-question, next-question, reload, and
  completion behavior (AC 8–9).

**Approach:**

- Remove only legacy Test-mode branches made unreachable by the assessment
  routes, retaining the Practice pool.
- Ensure selected standards are resolved once per test creation and prefetch
  does not race/replace a persisted assignment.

**Done when:** no Test request uses the legacy pool and the documented tests and
manual journey are green.

### T6: Preserve partial tests and expose learning history

**Depends on:** T1-T4

**Touches:** `app/src/server/learning/assessment.ts`, `app/src/server/learning/sqlite-repository.ts`, `app/src/app/api/test/exit/route.ts`, `app/src/app/api/history/route.ts`, `app/src/app/page.tsx`, relevant tests

**Tests:**

- TDD/integration: learner-only exit atomically marks one active assessment partial, retains answered review, rejects foreign/non-learner requests, and permits a new test.
- TDD/integration: history returns only the learner's practice attempts and completed/partial assessment summaries in chronological order without changing mastery.
- Visual/manual QA: confirm Exit test, observe partial status and compact History entries for both modes.

**Approach:**

- Extend the local assessment schema through a safe compatibility migration.
- Keep history query projections focused and redacted; use a compact page panel rather than a new navigation surface.

**Done when:** partial tests and both record types are visible, learner-scoped, and deterministically tested.

## Rollout

**Delivery:** local-first big-bang replacement of the unfinished Test branch.
The assessment tables are additive and existing databases may be deleted during
local development as approved. Rollback retains the tables but can return the
UI to Practice-only; no external deployment or data migration is required.

## Risks

- Limited fallback bank coverage can leave a selected standard unavailable when
  the local model is not configured; test creation must report that before
  committing a broken assessment where feasible.
- Existing tests share a local SQLite database, so assessment fixtures must use
  isolated paths or cleanup to avoid order dependence.
- The current repository lacks the mandated work-loop scripts, so full-mode
  state-machine and status-lint gates cannot be executed until repository drift
  is repaired.

## Changelog

- 2026-08-17: Closed as Done — browser journeys (setup, mixed-skill active
  test, reload/resume, unavailable-question retry, completion review,
  keyboard use, Performance follow-through) recorded in notes/manual-qa.md;
  one non-blocking terminal-state counter defect filed for follow-up.

- 2026-08-16: Initial plan from the confirmed Practice/Test separation contract.
