# Plan: Engagement Achievements

- **Spec:** [`spec.md`](spec.md)
- **Status:** Drafting

## Approach

Ship achievements as a deterministic read model over accepted learner Practice
attempts, not a gamification event store. Compute lifetime correct totals and
calendar-day streaks in the parent-selected `America/New_York` timezone; derive threshold badges
and select a reviewed fact. Present them through the existing UI/A2UI catalog
only after the isolation, timezone, and copy policies are frozen.

## Constraints

- Practice only: no Test, parent preview, Pi, or client event can alter totals.
- No leaderboard, notifications, rewards, or mastery semantics.
- V1 uses `America/New_York`; changing timezone is deferred behind an approved
  parent account-settings policy.

## Construction tests

**Integration tests:** accepted/replayed/rejected/Test/parent-preview matrix,
thresholds, no-store/scope/redaction. **Manual verification:** all achievement
states with keyboard/reduced motion and supportive copy.

## Design (LLD)

### Data & schema

Begin with recomputation from authoritative Practice attempts and an approved
IANA account timezone. Use UTC timestamps only for storage; convert only for
day grouping. A persisted achievement event is deferred until measurement shows
the read model needs it.

### Component / module decomposition

- `server/learning/achievements.ts`: eligibility, totals, day buckets, badges.
- reviewed `fun-facts` catalog: immutable text/source/category metadata.
- learner/A2UI components: fixed badge/progress/fact surfaces.

### Failure, edge cases & resilience

Malformed timestamps/facts are omitted safely. Unset timezone presents setup,
not a guessed streak. Historic data is recomputed; assignment replay cannot
create duplicate correctness. Facts never block progress rendering.

## Tasks

### T1: Freeze Eastern Time streak, copy, and fact-source policy

**Depends on:** `spec:parent-performance-portal/T1`

**Tests:** table of timezone/day-boundary/late-day and badge eligibility examples.

**Approach:** use `America/New_York` in v1, defer timezone changes, and define
badge catalog plus fact review/provenance fields.

### T2: Implement deterministic achievement read model

**Depends on:** T1

**Tests:** TDD eligibility, totals, threshold, calendar-day, exclusion, caps.

**Approach:** use only accepted Practice records and isolate a pure domain module.

### T3: Expose and render learner-safe achievements

**Depends on:** T2, `spec:a2ui-learning-delivery/T2`

**Tests:** route isolation/no-store/redaction plus visual/manual state matrix.

**Approach:** add a read-only BFF and fixed catalog components; do not create
notifications or social features.

## Risks

- Streaks can cause pressure; mitigate with neutral “start again” copy and no
  loss animation/notification.
- Timezone ambiguity corrupts calendar claims; block release without policy.
- Fun facts can become unreviewed content; require local provenance/catalog.

## Changelog

- 2026-08-16: Drafted from user-directed open-ended practice engagement goals.
