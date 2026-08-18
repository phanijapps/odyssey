# Spec: Parent Practice Recency

- **Status:** Shipped
<!-- approver: maintainer, session approval 2026-08-18 ("go for it") -->
- **Mode:** full (risk triggers: public-interface change — `ParentSafePerformance`
  gains a field; governance — a Never-do line is amended per RFC-0005)
- **Owner:** Product and Engineering
- **Plan:** [`plan.md`](plan.md)
- **Related:** [parent-progress-cards](../parent-progress-cards/spec.md),
  [parent-performance-portal](../parent-performance-portal/spec.md),
  [RFC-0005](../../rfc/0005-define-parent-interaction.md)
- **Brief:** RFC-0005 accepted decision, 2026-08-18 — parent surfaces may show
  day-granularity recency ("last practiced: 2 days ago").
- **Contract:** `ParentSafePerformance.practice` gains
  `lastPracticedDaysAgo: number | null`, defined as **the number of
  midnights in `America/New_York` between `now` and the most recent ET
  calendar day with a correct attempt** — 0 = last practice fell on the same
  ET calendar day as `now` (so a 23:45 ET attempt viewed at 00:30 ET the
  next day reads 1), null = no correct attempts ever. It is computed by a
  new exported helper in `achievements.ts`,
  `daysSinceLastCorrectPractice(learnerId: string, now: Date): number | null`,
  which queries the most recent correct attempt and reuses `easternDay`.
  The value flows through `GET /api/parent/performance`'s `children`
  projection and the A2UI document's per-child line, phrased as
  "last practiced today" / "last practiced yesterday" /
  "last practiced N days ago" / "hasn't practiced yet". No time-of-day, no
  dates, no other new fields. `parent-performance-portal`'s Never-do line
  is amended in the same change from "exact child activity timestamps" to
  timestamps finer than day granularity.
- **Shape:** feature

## Objective

Parents see when their child last practiced, at day granularity — the
recency fact the accepted RFC called the most-requested parent datum —
without exposing any time-of-day information.

## Acceptance criteria

- [x] `daysSinceLastCorrectPractice` (new export from `achievements.ts`,
      `(learnerId, now) => number | null`, reusing the Eastern-Time day
      math) returns null with no correct attempts, 0 for the same ET day,
      and correct midnight counts — pinned by unit tests with a frozen
      `now`, including the boundary case (attempt 23:45 ET Aug 17, `now`
      00:30 ET Aug 18 → 1).
- [x] `GET /api/parent/performance` `children` entries carry
      `practice.lastPracticedDaysAgo` — the route test's exact-shape
      `toEqual` is extended to pin it; separately, the response still
      greps clean for
      `accountId|childId|topicId|occurredAt|standardCode|assignmentToken`
      and contains no time-of-day or date-string material.
- [x] The card stat line shows the recency phrase via the shared
      `formatPracticePhrases` helper; a never-practiced child shows
      "hasn't practiced yet".
- [x] The document's per-child line includes the recency phrase and
      renders end-to-end without truncation (no A2UI text-length limit
      exists — `a2ui/document.ts` validates structure only — so visual QA
      is the truncation check).
- [x] `parent-performance-portal`'s Never-do line is amended to ban
      timestamps finer than day granularity (citing RFC-0005) — no other
      drift.
- [x] Gates green; visual QA seeds the attempt at ET noon two ET days
      before a `now`-anchored run so the expected phrase is
      "last practiced 2 days ago" regardless of the wall-clock moment the
      check executes.

## Boundaries

- **Always do:** compute recency from accepted correct attempts only, in
  `America/New_York` day terms, identical to the streak logic.
- **Ask first:** any granularity finer than a day; recency on any surface
  other than the parent portal.
- **Never do:** expose dates, times, or time-of-day; add per-topic recency
  (topic-level activity detail remains out).

## Testing strategy

- **TDD:** unit tests for `daysSinceLastCorrectPractice` (null/0/N,
  ET-day boundary) written first; route test `toEqual` extended first
  (red) for the new field; document test's pinned line updated for the
  recency phrase.
- **Visual / manual QA:** seeded attempt dated `today - 2 days` renders
  "last practiced 2 days ago" on the card; a fresh child shows "hasn't
  practiced yet".

## Assumptions

- Recency means correct-attempt days; a child with only incorrect attempts
  shows "hasn't practiced yet" (v1 — same evidence class as the streak).
