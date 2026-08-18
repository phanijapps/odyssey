# Spec: Parent Suggested Practice

- **Status:** Shipped
<!-- approver: maintainer, session approval 2026-08-18 ("go for it" on the accepted RFC-0005 option A) -->
- **Mode:** full (risk triggers: new public routes and a schema migration;
  write-path crosses the parent mutation boundary; multi-task)
- **Owner:** Product and Engineering
- **Plan:** [`plan.md`](plan.md)
- **Related:** [RFC-0005](../../rfc/0005-define-parent-interaction.md)
  (Accepted — option A), [parent-performance-portal](../parent-performance-portal/spec.md),
  [parent-progress-cards](../parent-progress-cards/spec.md)
- **Brief:** RFC-0005 accepted decision — the parent interaction surface is
  suggested practice: a parent marks one of the child's already-recommended
  skills as "practice together tonight"; the child sees a quiet, dismissible
  suggestion and practices via the existing learner flow.
- **Contract:** schema v11 adds `parent_practice_suggestions` (one active row
  per child — `CREATE UNIQUE INDEX
parent_practice_suggestions_one_active ON parent_practice_suggestions
(child_account_id) WHERE state = 'active'` — keyed to a topic from the
  child's mistake-to-mastery plan, `template_key TEXT NOT NULL CHECK
(template_key = 'practice-together')`: no free-text column exists) and
  `parent_suggestion_events` (append-only, immutability triggers, fixed
  event-type CHECK), per the accepted separate-audit-table decision.
  Parent REST under the existing link and mutation-proof guards: the route
  `GET /api/parent/children/:childId/suggestions` returns
  `{ recommended: [{standardCode, standardText}], active: {standardCode,
standardText} | null }` — with no completed Test, `recommended` is `[]`,
  `active` is `null`, and the shape is invariant; no topic ids cross any
  parent-facing wire. POST semantics, exactly: if the exact one-key body's
  `standardCode` is in the child's current plan, one transaction cancels any
  active suggestion (appending `cancelled-by-parent` when superseding),
  creates the new active row, and appends `suggested` → 201; if it is not in
  the plan, reject 400 with zero writes and the existing suggestion
  unchanged. DELETE cancels → 204. Child REST: `GET /api/suggested-practice`
  (guard `requireLearnerRead`, session-based like every learner read)
  returns the signed-in child's active suggestion validated against the
  current plan, or none; the routes `POST /api/suggested-practice/accept`
  and `/dismiss` (guard `requireLearnerMutationProof`) transition the
  lifecycle and append audit rows — accept returns `201 {topicId}` so the
  child's own client can open that skill's existing practice flow (a
  learner seeing their own topic id is house-normal; the ban is on
  parent-facing payloads). Accepting never mutates mastery, attempts, or
  streaks; practice does what it already does. The suggestion itself never
  appears in the parent performance aggregates. Multi-parent is allowed by
  the links schema: superseding is last-writer-wins, and the audit rows
  record every actor.
- **Shape:** feature

## Objective

Turn "parents interact" from account administration into the one action the
product exists for — with the child's existing practice flow doing all
learning-side mutation, an append-only audit trail, and templates only.

## Acceptance criteria

- [x] Migration v11 (bumping `LATEST_SCHEMA_VERSION` to 11) creates both
      tables idempotently (`IF NOT EXISTS`, triggers only if missing); the
      events table rejects UPDATE and DELETE via triggers; at most one
      `active` suggestion exists per child (partial unique index); the
      template CHECK admits only `practice-together` — pinned by a migration
      test covering fresh and re-run paths.
- [x] `POST` with a `standardCode` outside the child's current plan fails
      closed (400, zero writes, existing suggestion intact); inside the plan
      it supersedes atomically and appends `suggested` (plus
      `cancelled-by-parent` when superseding); exact one-key body enforced
      (400 otherwise). Concurrent supersedes are last-writer-wins and each
      appends its own audit rows.
- [x] Parent routes enforce: anonymous reads 401 (anonymous mutations fail
      the proof with 403, house behavior), non-parent 403, unlinked parent
      403, cross-origin mutation 403, no-store on every response.
- [x] Child routes enforce: `requireLearnerRead` on GET (own suggestion
      only); `requireLearnerMutationProof` on accept/dismiss; acting on a
      suggestion that is no longer active (cancelled, dismissed, accepted,
      or plan-evicted) returns 404 with no audit row appended.
- [x] No parent-facing payload contains `topicId`, `accountId`, or
      `assignmentToken` (grep-pinned); the child's own accept response may
      carry the learner's own `topicId`.
- [x] Parent card shows a per-child "Suggest practice" expander — refetched
      on every open and after every mutation, with a loading state —
      listing recommended skills by code; an active suggestion renders with a
      cancel control; superseding and cancelling update the UI from server
      state.
- [x] The child's portal shows a quiet banner for an active suggestion
      ("Your parent suggests practicing {code}") with "Practice it" (accepts
      → opens that skill's existing practice flow via the returned topicId)
      and "Not now" (dismisses); dismissed, accepted, cancelled, and
      plan-evicted suggestions never render.
- [x] Revoking a parent-child link cancels that child's active suggestions
      in the same `BEGIN IMMEDIATE` transaction, appending
      `cancelled-by-parent` before commit.
- [x] The `a2ui-action-schema-guards` backlog item remains open and
      documented as scoped to the A2UI action channel (this feature's parent
      actions are REST, guarded by link + mutation proof; the portal spec
      amendment records the interaction surface and its audit table).
- [x] Gates green (`pnpm test` / `typecheck` / `lint` / `build` /
      `test:e2e`), with a new e2e journey (seeded completed test per the
      existing seeding pattern) covering parent-suggest → child-dismiss →
      parent re-suggest → child-accept → practice opens, and parent-cancel.

## Boundaries

- **Always do:** derive the topic server-side from the child's current plan
  at POST time; audit every lifecycle transition; keep the child's opt-in
  framing (dismiss is always available and quiet).
- **Ask first:** any free-text message (none exists by construction — the
  template CHECK has exactly one value); notifications outside the app;
  multiple simultaneous suggestions per child.
- **Never do:** let a suggestion mutate mastery/attempts/streaks, expose
  topic ids or account ids in parent-facing payloads, let a parent act as
  the child (or read child routes), or extend `parent_relationship_events`
  (the accepted decision is a separate audited table).

## Testing strategy

- **TDD:** migration test (fresh + re-run, triggers, partial index,
  template CHECK); module tests for the suggestion module (suggest
  happy/plan-rejection/supersede/accept/dismiss/cancel, last-writer-wins,
  audit rows appended, events immutable, one-active invariant) — with the
  public function list written before the tests; route tests for the full
  guard matrix on both route families; revoke-cancels-suggestion covered in
  the identity revoke test.
- **Visual / manual QA + e2e:** Playwright journey — parent opens the
  expander, sees the recommended list from a seeded completed test (the
  `parent-lifecycle.spec.ts` seeding pattern), suggests one; child signs
  in, banner renders, "Not now" dismisses (banner gone); parent re-suggests;
  child accepts and the practice screen opens at that skill; parent cancels
  an active suggestion. Run `pnpm test:e2e` in-loop (K-0004).

## Assumptions

- One parent per child is a v1 product constraint (the portal ships one
  parent account), not a database constraint — the links schema permits
  more, so supersede is specified last-writer-wins with full audit.
- The learner portal's existing topic-opening flow (the same one guidance
  cards use) can be targeted by topic id at accept time.
- A suggestion history beyond the audit table is out of scope for v1.
