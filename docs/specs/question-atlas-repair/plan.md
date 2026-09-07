# Plan: Question atlas repair

- **Spec:** [spec.md](spec.md)
- **Status:** Done

## Assumption trio

Touches: atlas generator/prompt and walker; progress and answer routes; session and
learning pool state; existing practice UI; regression tests and living architecture.
Done evidence: AC-mapped tests plus production browser journey and specialist review.
Excluded: persistent caching, new services/dependencies, new graph UI and scoring redesign.

Declined patterns: a separate job queue (one local process and session state suffice),
a configurable selection strategy (one consumer), and a general schema framework (reuse
existing validators and bounded atlas fields).

## Approach and design

Keep the current Next.js → route → session/learning → pure-core boundaries.
Persist a unique batch identity and generation lifecycle with the pool before launch.
Only the winning conditional write launches work; completion checks that identity.
Persist atlas metadata and walk state, use the existing walker when claiming an atlas
question, and record the last answer outcome in the same transaction as consumption.
The active assignment takes precedence over all selection. Existing sessions without
atlas fields keep their bank behavior. Model output is unknown until validated.

Pending generation is a successful no-store read with an explicit loading signal;
failed generation offers retry, and exhausted practice offers a new round. The browser
polls pending reads without claiming another active question and ignores stale skill
responses. No answer request generates questions. Runtime pending work is bounded by
the existing provider deadline; expired pending state is recoverable after restart.

## Tasks

### T1: Generated batches and tree selection satisfy their contracts

**Depends on:** none
**Verification mode:** TDD
**Tests:** AC3–4: unsorted initial nodes, prerequisites, sibling/deepen/widen, null/non-object envelopes, over-limit fields, bad individual nodes, unsafe SVG, valid balanced batches.
**Approach:** Add failing tests, repair existing walker and generator, preserve original answer keys.
**Done when:** all new core/AI tests pass against the repaired implementation.

### T2: Session handoff and answer-driven tree practice work under concurrency

**Depends on:** T1
**Verification mode:** TDD
**Tests:** AC1–3, AC5–6: deferred atlas completion, duplicate initial reads, A→B→A, active token preservation, disabled generation, no-bank start, pending/failure/retry, exhaustion, answer outcome and redaction.
Existing AC6 guards: `webapp/app/api/progress/route.test.ts` (learner isolation,
reviewed composite identities); `webapp/app/api/answer/route.test.ts` (token replay
and progression); new `webapp/app/api/progress/atlas.test.ts` (cross-origin rejection,
atlas answer points); `webapp/server/learning/assessment.test.ts` and
`webapp/app/api/test/route.test.ts` (assessment isolation). Add answer-limit
regression where a reviewed identity exceeds the old 100-character ceiling,
using the existing guidance ceiling of 300 characters for transport consistency.
**Approach:** Add batch/walk metadata to existing session pool and wire claims and answer consumption; remove obsolete route statements.
**Done when:** real SQLite route tests demonstrate the integrated policy and race protection.

### T3: Learner states and project documentation reflect the working system

**Depends on:** T2
**Verification mode:** Visual / manual QA and goal-based check
**Tests:** AC5–7: built browser sign-in → skill → answer → next → completion/retry; progress and loading visible. No stub (manual QA). Run full gates and build.
**Approach:** Update existing practice state presentation, record technical debt, reconcile living architecture and review the complete diff.
Documentation scope: `docs/product/technical-debt.md`; `docs/architecture/overview.md`
(layout, ownership, atlas flow); `docs/architecture/application.md` (module paths,
atlas lifecycle and progress response table); `docs/architecture/reference.md`
(actual package paths and boundaries); `README.md` (workspace tree/config paths
and practice behavior); `docs/specs/README.md` (repair index). Frozen ADR/RFC bodies
and unrelated product roadmap changes are excluded. Root/nested AGENTS policy
drift is recorded in the debt register rather than silently rewritten.
**Done when:** recorded browser evidence, all gates clean, review findings resolved.

## Risks and rollout

Late completions and legacy session JSON are the main compatibility risks. Additive
session fields avoid a migration. No production data changes or deployment are part
of verification; isolated databases and a deterministic model endpoint are used.

## Resolve-versus-surface record

- Resolved: runtime/package layout from manifests; missing tree wiring from call-site audit.
- Resolved: baseline tests and typecheck pass, but provide no atlas integration evidence.
- Pending: exact meaning of initial graph (asynchronous clarification sent).
- Named skips: design-intent/frontend specialists unavailable; direct built-browser verification required.
- Spec review round 1: applied explicit numeric batch contract, route state and
  restart/deadline contract, named AC6 regression paths, and bounded documentation
  list. Generated prerequisite-edge authoring is explicitly excluded; optional
  core prerequisite checks remain a repair to the existing type's contract.
- Spec security review: applied reviewed-only prompt input and exact completion
  caps in AC1/AC5. Boundary helper reference is added to the already scoped
  architecture reference, avoiding a duplicate security document.

## Changelog

- 2026-09-07: Initial repair plan from current code audit; baseline 213 tests pass.
