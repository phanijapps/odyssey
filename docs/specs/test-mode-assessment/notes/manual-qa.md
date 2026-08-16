# Manual QA: test mode assessment

- **Date:** 2026-08-16
- **Environment:** existing local Next.js development server

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

## Browser visual QA

Pending: exercise the rendered Practice and Test journeys in a browser, including
mixed-skill selection, reload/resume, unavailable-question retry, completion review,
and keyboard focus. The available harness had no browser-control tool.
