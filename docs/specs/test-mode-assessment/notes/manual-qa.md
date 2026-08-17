# Manual QA: test mode assessment

- **Date:** 2026-08-16 (HTTP journey); 2026-08-17 (browser journey, current UI)
- **Environment:** existing local Next.js development server (2026-08-16);
  isolated-port dev server with isolated databases and the documented opt-in
  local model configuration (2026-08-17)

## Observed HTTP journey

1. Authenticated a local learner session and selected a reviewed Gold standard.
2. Started `POST /api/test` and received an active assessment and first question.
3. Confirmed the pre-completion question DTO exposed only ordinal, total, question,
   and optional diagram. It did not include answer, hint, solution, correctness, or
   points.
4. Confirmed `POST /api/test/exit` changed the active assessment to `partial`.
5. Confirmed `GET /api/history` returned the learner-scoped partial-test summary.
6. Removed only the smoke-test assessment records from the local non-production
   SQLite database after the check.

## Automated coverage

`pnpm --dir app test` passed: 122 tests passed, 3 integration tests skipped.
`pnpm --dir app typecheck` passed.

## Browser visual QA (2026-08-17)

Exercised the rendered Test journey end-to-end in a real browser against the
built app:

1. **Mixed-skill selection** — switched to Test mode, selected 8.EE.7 and
   8.F.3 via the skill browser; selection chips rendered and Start enabled.
2. **Active test** — nine-question mixed-skill assessment started;
   navigation locked during the test; the pre-completion state showed only
   ordinal, question, and diagram with "Your answers and solutions appear
   when the test is complete."
3. **Reload/resume** — after a full dev-server restart and page reload, the
   active test resumed at exactly Question 2 of 9 from server state.
4. **Unavailable-question retry** — observed organically twice: a generator
   failure rendered "This question needs another try. Your test has not
   advanced. Retry the same question when the local generator is ready,"
   with the test position preserved. (The reviewed question-bank fallback
   covers some skills; generation requires the documented opt-in model
   configuration — one small local model did not fit the structured request
   envelope, matching the recorded limitation.)
5. **Completion review** — after the ninth answer, the review screen showed
   the score out of 180, every question's correct answer, and worked
   solution steps; navigation unlocked; New test / Back to practice offered.
6. **Keyboard focus** — every answer was submitted with the Enter key from
   the focused input; visible focus outlines are global.
7. **Follow-through** — Performance then showed the completed Test event and
   one guidance card per missed standard, and the "Practice this skill"
   action opened the exact standard's Practice flow.

**Observed defect (non-blocking, fixed 2026-08-17):** in the terminal state
the assessment header read "Question 10 of 9" — the fallback ordinal assumed
an upcoming question after the last answer. Fixed by
`app/src/app/learner/test-progress.ts` (pinned by its unit tests); the
completion review content itself was always correct.

## Automated coverage

`pnpm --dir app test` passed: 122 tests passed, 3 integration tests skipped.
`pnpm --dir app typecheck` passed.
