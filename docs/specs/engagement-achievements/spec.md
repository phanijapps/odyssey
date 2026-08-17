# Spec: Engagement Achievements

- **Status:** Shipped
- **Owner:** Product and Engineering
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** `mistake-to-mastery` (Draft); `parent-performance-portal` (Draft)
- **Brief:** none
- **Discovery:** learner progress and engagement research, 2026-08-16
- **Contract:** learner-only `GET /api/achievements` returns a recomputed, no-store Practice-only projection. It accepts no learner identifier and does not persist achievement events.
- **Shape:** mixed

## Implementation status

The deterministic learner projection is implemented with the explicitly
specified `America/New_York` calendar policy. It counts only correct persisted
Practice attempts, exposes 100/1,000-answer progress, and reports a current
active-day streak without creating a new achievement store. A small approved
local fun-fact catalog carries public-domain source metadata and is selected
deterministically; notifications, parent sharing, and a persistent event stream
remain deferred.

## Objective

Learners see encouraging, honest achievements for sustained **Practice** effort:
100 correct answers, 1,000 correct answers, consecutive active-practice-day
streaks, and curated fun facts. Achievements motivate open-ended learning
without creating a terminal mastery label, comparing learners, counting Test
results, or allowing parent activity to affect the child’s record.

## Boundaries

### Always do

- Count only accepted, learner-owned normal Practice answers after server token
  validation; Test results and parent previews never contribute.
- Make badge thresholds and streak policy explicit, deterministic, visible, and
  recomputable from authoritative redacted learning records.
- Show celebratory/progress states without leaderboards, ranking, loss framing,
  ability labels, or pressure to maintain a streak.
- Source fun facts from a reviewed local catalog with provenance; never generate
  factual claims through an unreviewed model response.

### Ask first

- Changing streak timezone/late-day policy, adding reminders/notifications,
  social sharing, leaderboards, rewards with monetary value, or external
  analytics.
- Persisting achievement events rather than recomputing them, or adding a
  parent-controlled achievement reset.

### Never do

- Treat badge count, streak, or checkpoint as mastery, grade, diagnosis,
  provider score, or eligibility decision.
- Count Test, parent-preview, synthetic, replayed, or failed submissions.
- Expose another learner’s achievement data or use it for comparison.

## Testing Strategy

- **TDD:** correct-answer eligibility, threshold crossing, idempotency,
  consecutive-day calculation, timezone boundaries, parent-preview exclusion,
  and fun-fact rotation.
- **Integration:** learner scope, no-store/redaction, Practice/Test isolation,
  duplicate assignment replay, and parent read/action policy.
- **Visual/manual QA:** achievement progress, newly earned badge, broken streak,
  empty state, reduced-motion behavior, keyboard access, and parent-safe view.

## Acceptance Criteria

- [x] Given 100 or 1,000 accepted learner Practice correct answers, the learner
      earns the corresponding badge exactly once in the derived projection.
- [x] Given Test answers, parent preview answers, replayed assignments, or
      rejected submissions, achievement totals and streaks do not change.
- [x] Given Practice on consecutive calendar days in the approved account
      timezone, the learner sees the correct active-day streak; a missing day ends
      the streak without shame-oriented copy.
- [x] Given an unset/invalid timezone, the app uses an explicit safe setup state
      rather than silently assigning a misleading calendar-day streak.
      (v1 has no assignable timezone — the zone is the compile-time
      `America/New_York` constant, so the misleading-streak state cannot
      occur.)
- [x] Given an achievement surface, it is learner-scoped, no-store, capped,
      redacted, and makes no mastery/provider/comparative claim.
- [x] Given a fun fact, it comes from a reviewed local fact catalog with source
      attribution metadata and never from uncontrolled model output.

## Assumptions

- Technical: Practice answers are server-token-bound and accepted attempts are
  authoritative; Tests and parent previews are isolated (source: current
  learning/assessment architecture and related Draft specs).
- Product: badges include 100 and 1,000 learner Practice correct answers,
  streaks, and fun facts; learning remains open ended (source: user confirmation
  2026-08-16).
- Product: v1 calendar-day streaks use the parent-selected Eastern Time IANA
  zone `America/New_York`; the parent can change timezone only through a future
  approved policy (source: user confirmation 2026-08-16).
