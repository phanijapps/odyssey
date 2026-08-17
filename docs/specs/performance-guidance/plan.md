# Plan: Performance and Guidance

- **Spec:** [`spec.md`](spec.md)
- **Status:** Executing

## Approach

Replace the learner History panel with a first-class Performance destination.
A server read model prepares a small redacted evidence DTO, then emits a
validated A2UI v0.9.1 surface using an Odyssey-owned catalog. The maintained
React renderer maps that catalog to fixed accessible components in the current
visual language. Mistake-to-Mastery supplies the next practice action. Pi may
propose bounded prose only after the evidence projection and before server
validation; it does not choose scope, facts, actions, score, or catalog.
A real parent portal is sequenced behind a dedicated relationship/auth spec.

## Constraints

- RFC-0004 and Mistake-to-Mastery must be approved first.
- Preserve the current Practice/Test layout, math rendering, server-owned
  identity, response validation, and no-store policy.
- Install only the official `@a2ui/react` and `@a2ui/web_core` dependencies
  after their exact installed contract is acquired; no generic agent framework.
- Target stable A2UI v0.9.1, not the v1.0 Candidate protocol.

## Construction tests

**Integration tests:** view-document schema rejects unknown variants/fields;
Performance route learner isolation/no-store/redaction; separate Practice/Test
projections; action target validation; no write statements.

**Manual verification:** navigate through all page states with keyboard and
narrow/desktop layouts; capture the visual QA record; verify a Test review and
Practice action do not alter unrelated state.

## Design (LLD)

### Design decisions

A2UI v0.9.1 is the controlled transport. Odyssey registers a version-pinned,
allowlisted catalog over Basic Catalog primitives plus semantic local components.
It supports `summary`, `practice-skill`, `assessment-event`, `guidance`, and
`empty` compositions only. Catalog actions map to a closed server action
registry; unknown components, functions, bindings, data-model paths, action
arguments, or fields are errors. React owns visual composition, styling, and
accessibility.

### Interfaces & contracts

`GET /api/performance` is learner-only and returns a validated A2UI v0.9.1
surface envelope plus a bounded data model. It accepts no child ID. It is no-store/read-only and
never returns a plan source ID, assessment ID, raw count row, answer data, or
arbitrary navigation URL. A final OpenAPI/BFF contract is authored before
implementation.

### Component / module decomposition

- `server/learning/performance.ts`: evidence projection; no HTTP/UI concerns.
- `server/performance-a2ui.ts`: A2UI surface builder, catalog validator, and
  action binding validator.
- `app/api/performance`: identity + BFF adapter only.
- `app/performance/page.tsx`: fetch/orchestration.
- `app/performance/components/*`: one fixed renderer per variant, plus shared
  state/error shell.

### State & control flow

The page requests one A2UI surface on load and supports retry. The envelope is
validated at server construction and by the renderer catalog boundary. An allowed Practice action
routes through an existing validated selection path. Terminal Test review uses
existing assessment retrieval, not a copied answer/review component.

### Behavior & rules

Practice accuracy/skill labels require approved minimum evidence. Tests remain
a separate event stream. Guidance uses deterministic template text plus
Mistake-to-Mastery state. A missing or stale target becomes an unavailable card,
not a substitute live target.

### Failure, edge cases & resilience

No history, sparse evidence, partial-only Tests, deleted Gold, malformed legacy
records, route errors, stale action, unknown A2UI component/function, invalid
binding, and unsupported renderer capability each map to explicit safe visual
states. Server fallback uses an `empty` or `unavailable` document;
client fallback does not interpret arbitrary values.

### Quality attributes (NFRs)

Cap cards/events; parameterize all queries; use semantic headings/buttons,
visible focus, live-region retry feedback, and reduced-motion-safe transitions.
No user-visible result depends on JavaScript timing beyond current app behavior.

## Tasks

### T1: Acquire and freeze the A2UI v0.9.1 integration contract

**Status:** Complete for the read-only learner Performance subset. The installed
React 0.9.1 package resolves to web core 0.9.2; only versioned v0.9 entrypoints
and the fixed local catalog are used.

**Depends on:** `spec:mistake-to-mastery/T1`

**Tests:** compile a minimal React renderer callsite against the installed
packages; red fixtures cover unknown catalog component/function, invalid
binding/action, too-long text, invalid target, and unacceptable evidence label.

**Approach:** record exact dependency versions, package/API contract, Odyssey
catalog, renderer capability, server action registry, evidence thresholds, card
cap, copy/tone rules, and HTTP transport contract before components exist.

### T2: Build the Performance evidence read model

**Status:** In progress. The delivered projection is a capped, redacted factual
history summary. A fuller recent Practice summary requires three reviewed
Practice attempts; this activity-evidence threshold does not imply readiness or
mastery. Deterministic Mistake-to-Mastery guidance is present; actions remain
deferred.

**Depends on:** T1, `spec:mistake-to-mastery/T2`

**Touches:** `app/src/server/learning/performance.*`

**Tests:** TDD over empty/sparse/ready/partial/terminal/snapshot/deleted-target
fixtures and proof of no writes.

**Approach:** compose existing redacted history and plan read models without a
second analytics store.

### T3: Enforce the A2UI BFF and catalog boundary

**Status:** In progress. The learner-only no-store route, strict dual-side
envelope validation, component cap/graph checks, and fixed renderer are
implemented; actions and broader variants remain deferred.

**Depends on:** T2

**Touches:** `app/src/server/performance-view.*`, `app/src/app/api/performance/*`

**Tests:** route auth, no-store, redaction, cap, malformed document rejection,
and action-target contract tests.

**Approach:** add server envelope/catalog validation, data-model construction,
and thin learner route; exclude parent scope and make Pi insight output optional
and validated after deterministic evidence calculation.

### T4: Deliver the A2UI Performance page in the existing visual language

**Status:** In progress. Navigation and empty-state browser coverage are
implemented; guidance, action, Test-review, and full manual accessibility
parity remain.

**Depends on:** T3

**Touches:** `app/src/app/performance/*`, `app/src/app/page.tsx`, learner UI

**Tests:** page state tests where supported and documented manual visual QA for
keyboard, mobile, empty, ready, error, Test review, and Practice action.

**Approach:** move History navigation to Performance, install the official React
renderer, register only Odyssey components, and reuse established card, button,
typography, MathText, and assessment review patterns.

### T5: Remove the replaced learner History surface only after parity review

**Depends on:** T4

**Tests:** route/page regression plus manual comparison confirms all formerly
visible redacted events/retry states remain reachable in Performance.

**Approach:** delete only duplicate UI/state after feature-parity evidence; keep
History API if it remains an external compatibility surface.

## Risks

- A versioned document may be ceremony for one page; contain it to a small
  closed union and do not add a general renderer.
- Evidence labels can shame/mislead; require product copy review and thresholds.
- Existing test harness lacks browser rendering; record manual QA until a
  browser harness has an approved need.

## Changelog

- 2026-08-16: Drafted from learner UI and A2UI research.
- 2026-08-17: Implemented a bounded factual learner Performance subset without guidance/actions.
