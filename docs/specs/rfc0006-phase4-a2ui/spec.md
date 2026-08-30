# RFC-0006 phase 4 — replace A2UI with plain validated rendering

**Status:** Shipped
**Mode:** full (risk triggers: structural change, user-facing surface change, dependency removal)
**Contract of record:** [`docs/rfc/0006-simplify-to-persona-app.md`](../../rfc/0006-simplify-to-persona-app.md) Phase 4; owner approved the replacement path in session.

## Objective

Remove the `@a2ui/react` and `@a2ui/web_core` dependencies and the
server-driven-document indirection. Learner interactions (text response,
multiple choice, true/false) render from the existing zod-validated
`LearnerQuestionInteraction` payloads through one plain client component;
performance and parent-performance surfaces render plain typed payloads.
No behavior change beyond identical-looking UI served by ~150 lines
instead of ~1,900.

## Boundaries

- Answer submission still flows through the existing token-bound
  `/api/answer` and `/api/test/answer` contracts — only the document
  rendering channel changes.
- Server-side validation (zod at the boundary) is preserved for every
  payload the client renders; the client trusts its same-origin API and
  drops its duplicate re-parse.
- Performance/parent-performance payload shapes stay additive-identical in
  information (title, summary, per-skill status, guidance cards with
  practice targets) — only the envelope changes from A2UI messages to
  plain JSON.

## Acceptance criteria

- [x] AC1: `@a2ui/react` and `@a2ui/web_core` are absent from
      `app/package.json` and `pnpm-lock.yaml`; `app/src/a2ui/` and the three
      surface wrappers (`a2ui-surface.tsx`, `practice-a2ui-surface.tsx`,
      `test-a2ui-surface.tsx`) are gone.
- [x] AC2: practice and assessment panels render every interaction type
      (text/MC/TF) from the `interaction` payload; routes no longer emit an
      `a2ui` field.
- [x] AC3: `/performance` renders the learner report and its
      "Practice this skill" action from a plain payload; parent performance
      route returns a plain payload consumed by the parent page without
      `formatPracticePhrases`' A2UI envelope.
- [x] AC4: gates green (`pnpm typecheck && pnpm test && pnpm lint`);
      production smoke exercises practice (each interaction type), test mode,
      and the performance page.

## Testing strategy

- Unit: interaction renderer component tests (renders each type, submits
  bound value); performance payload builder tests ported from the A2UI
  document tests (same fields asserted on the plain shape).
- Route tests updated: progress/test/performance/parent-performance assert
  plain payloads and no `a2ui` key.
- Manual QA: production server — practice one question of each interaction
  type, run a test question, open performance page, open parent page.

## Assumptions

- `learnerQuestionInteractionSchema` remains the versioned interaction
  contract (unchanged).
- The performance guidance-card copy and phrasing carry over verbatim.
