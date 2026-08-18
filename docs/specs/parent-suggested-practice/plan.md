# Plan: Parent Suggested Practice

- **Status:** Done
<!-- approver: maintainer, session approval 2026-08-18 ("go for it" on the accepted RFC-0005 option A) -->

## Assumption trio

- **Touching:** `app/src/server/persistence/sqlite.ts` (v11) + its test,
  new `app/src/server/learning/parent-suggestions.ts` (+ test), new routes
  `app/src/app/api/parent/children/[childId]/suggestions/route.ts` (+ test)
  and `app/src/app/api/suggested-practice/{route,accept,dismiss}/route.ts`
  (+ test), `app/src/app/parent/page.tsx`, `app/src/app/page.tsx` (learner
  banner), `app/e2e/parent-lifecycle.spec.ts`, portal spec amendment,
  changelog, README, this spec dir.
- **Done when:** all ACs checked; gates + `pnpm test:e2e` green with the
  new journey; visual QA screenshots recorded.
- **Not changing:** `parent_relationship_events` (separate table per the
  accepted decision), performance aggregates/preview, streak/attempt logic,
  guards' existing semantics, learner practice grading.

## Declined patterns

- A `PUT`-style upsert verb — POST supersedes in one transaction and one
  audit story; no second caller needs differ.
- Free-text `message` column — templates-only is the accepted policy; the
  CHECK constraint makes the policy structural.
- `topicId` in payloads — server re-derives from the plan by standardCode;
  internal ids stay internal.
- Suggestion rows in performance aggregates — suggestions are interaction,
  not evidence.
- Closing `a2ui-action-schema-guards` — this feature rides REST guards; the
  item stays scoped to the A2UI action channel.
- A shared parent/child "suggestion center" page — one banner and one card
  expander are the whole v1 surface.

## Resolve-vs-surface disposition record

Closed at DECIDE: clean code review (zero findings) after spec-stage review
(19 findings disposed); all gates green incl. e2e 6/6 with the new journey;
visual QA recorded across parent picker, suggested state, child banner, and
practice-open. Nothing surfaced to a human.

## Tasks

### T1a — Schema v11 (TDD)

**Tests:** migration test — fresh path and re-run path, both tables, the
partial unique index (`WHERE state = 'active'`), the template CHECK
(`= 'practice-together'`), and UPDATE/DELETE rejection via triggers — red
first. Implement migration v11 in `sqlite.ts` (idempotent: `IF NOT EXISTS`,
triggers only if missing) and bump `LATEST_SCHEMA_VERSION` to 11.

Verification: TDD red→green + gates.

### T1b — Suggestion module (TDD)

**Public functions first, then tests red:** `listSuggestionState(childScopeKey)`
(read-only view for routes), `suggestPractice(parentAccountId, childAccountId,
standardCode)` (plan-membership validation, atomic supersede,
last-writer-wins), `acceptSuggestion(childAccountId)` /
`dismissSuggestion(childAccountId)` (404-style miss when not active, no
audit row on miss), `cancelSuggestion(parentAccountId, childAccountId)`, and
`cancelSuggestionsForChild(childAccountId, tx)` for the revoke path. Tests:
happy/plan-rejection (zero writes, existing intact)/supersede (+`cancelled-by-parent`
audit)/accept/dismiss/cancel, events immutable, one-active invariant.

Verification: TDD red→green + gates.

### T2 — Parent suggestion routes (TDD)

**Tests:** route test matrix — GET/POST/DELETE × (anon 401, learner 403,
unlinked parent 403, linked parent happy, exact body 400, cross-origin 403,
no-store); GET with an empty plan pins `{recommended: [], active: null}`.
Implement routes with `requireParentRead` / `requireParentMutationProof` +
active-link resolution reusing the children route's pattern.

Verification: TDD red→green + gates.

### T3 — Child suggestion routes (TDD)

**Tests:** GET (`requireLearnerRead`, session-based) returns own active
suggestion (plan-validated) and none for others; accept/dismiss
(`requireLearnerMutationProof`) append audit, return the learner's own
`{topicId}` on accept, 404 (no audit row) when the suggestion is no longer
active, and are invisible to parent sessions. Implement with
`requireLearnerRead` / `requireLearnerMutationProof`.

Verification: TDD red→green + gates.

### T4 — Parent card expander + child banner (visual QA + e2e)

Parent card: "Suggest practice" expander — fetches GET on first open,
re-fetches after every mutation, shows a loading state — listing recommended
codes, with suggest/cancel pending states. Child portal: quiet banner with
"Practice it" (accept → open that skill's existing practice flow via the
returned topicId) and "Not now". The revoke path cancels active suggestions
in-transaction (identity.ts calls `cancelSuggestionsForChild`). Extend
`parent-lifecycle.spec.ts` with the full journey — seeding the completed
Test per the existing pattern in that file; run `pnpm test:e2e` in-loop.

Verification: **visual QA** screenshots + e2e green.

### T5 — Records

Portal spec amendment (interaction surface now exists; audit table named),
changelog, README row, statuses, `lint-spec-status.py`.

Verification: goal-based — clean tree, linter clean.
