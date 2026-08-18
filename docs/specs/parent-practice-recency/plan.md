# Plan: Parent Practice Recency

- **Status:** Done
<!-- approver: maintainer, session approval 2026-08-18 ("go for it") -->

## Assumption trio

- **Touching:** `app/src/server/learning/achievements.ts` (+ its test),
  `app/src/server/learning/parent-performance.ts`,
  `app/src/app/api/parent/performance/route.test.ts`,
  `app/src/a2ui/parent-performance-document.ts` (+ its test),
  `app/src/app/parent/page.tsx`,
  `docs/specs/parent-performance-portal/spec.md`, changelog, specs README,
  this spec dir.
- **Done when:** unit + route tests pin the new field and phrases, gates
  green, and Playwright records the seeded "last practiced 2 days ago"
  card.
- **Not changing:** streak/count logic, learner-facing `/api/achievements`
  payload, guards, preview, suggestion work (separate spec).

## Declined patterns

- Adding the field to `AchievementProjection` — changes the learner route's
  shape for a parent-only need.
- A "lastIncorrectPractice" variant — no caller; correct-attempt recency
  matches the streak's evidence class.
- ISO strings in the payload — day-count integers only, per the accepted
  RFC wording.
- Caching the day diff — recomputed per read like every other aggregate.

## Resolve-vs-surface disposition record

Closed at DECIDE: all REVIEW findings applied (evaluation-clock threading,
comments, RFC link, e2e restoration); the ET-boundary Blocker verified fixed
in round 2. Nothing surfaced to a human.

## Tasks

### T1 — Recency aggregate (TDD)

**Tests:** `achievements.test.ts` gains `daysSinceLastCorrectPractice`
cases with a frozen `now` — null (no correct attempts), 0 (same ET day), N
days, and the boundary case: attempt 23:45 ET Aug 17, `now` 00:30 ET Aug
18 → 1 — red first. Then implement the new export in `achievements.ts`
reusing `easternDay` (midnight counting), and add `lastPracticedDaysAgo`
to `ParentSafePerformance` in `parent-performance.ts`.

Verification: the new unit tests pass including the ET boundary case;
lint/typecheck clean; gates green.

### T2 — Projection + phrases (TDD + visual QA)

**Tests:** route test `toEqual` extended (red) with
`lastPracticedDaysAgo`; document test's pinned lines updated with the
recency phrase. Then: `formatPracticePhrases` gains `recency` (param
extends), document line and card stat line render it; card shows "hasn't
practiced yet" for null.

Verification: TDD red→green, then **visual QA**: seed the attempt at ET
noon two ET days before the run's `now` (computed in the seed script, not
wall-clock relative), assert the card reads "last practiced 2 days ago"
and the document line renders without truncation.

### T3 — Governance amendment + records

Amend the portal spec Never-do line (timestamps finer than day
granularity, citing RFC-0005); changelog; README row; statuses.

Verification: goal-based — `lint-spec-status.py` clean, `git status`
clean.
