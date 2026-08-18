# Code review — parent-practice-recency (full mode)

Round 1 findings (adversarial reviewer, 2026-08-18): one Blocker (route
test seeded with wall-clock `now` → ET-midnight flake window), concerns on
the midnightsBetween invariant, missing e2e recency coverage, and
streak/recency consistency; nits on the RFC link and UTC-crossover note.

Dispositions — all applied:

- Route accepts an optional evaluation clock used only when it is a real
  Date (Next's route-context second argument is ignored in production);
  the route test seeds ET noon and evaluates at two frozen instants.
- Invariant/consistency/UTC-crossover comments added to achievements.ts.
- RFC-0005 linked from the portal spec's amended Never-do line.
- The e2e concern exposed that the whole journey suite (not part of
  `pnpm test`) had drifted across the portal phases, and the preview spec
  still seeded `test_sessions` by raw accountId (stale since the
  scope-key fix). Both specs rewritten to the current UI; the preview seed
  uses the learner scope key; fresh-child card asserts the recency
  phrase. Learning captured as K-0004.

Round 2 verdict: **Clean — ready to commit.**
