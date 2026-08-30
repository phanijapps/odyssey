# RFC-0006 phase 4 — execution plan (rev 2)

**Status:** Shipped
**Spec:** [`spec.md`](spec.md)
Rev 2 incorporates pre-EXECUTE review findings 1–8: types.ts coverage,
plain-shape fidelity to the actual component set, e2e class/copy parity

- e2e gate, parent-performance route naming + cap home, full test
  inventory, CSS disposition, phrase-helper rewording, backlog closure.

### T1 Interaction renderer component

New `app/src/components/interaction-answer.tsx`: renders
`LearnerQuestionInteraction` (text input with maxLength, radio multiple
choice, true/false buttons) and reports the chosen value through
`onSubmit(value)`. TDD: renders each type; selection binding; maxLength
enforced.

### T2 Practice + assessment surfaces + types

- `learner/types.ts`: drop the a2ui import and `a2ui?` field; retype
  `interaction` as `LearnerQuestionInteraction` (type-only import —
  erased at compile time).
- `practice-panel.tsx` / `assessment-panel.tsx`: accept `interaction`,
  render `InteractionAnswer`; delete a2ui surface imports/props.
- `page.tsx`: drop `practiceA2ui` state, `submitA2ui*` handlers, and the
  `parseTextResponseInteraction` call sites; the renderer derives
  maxLength from the interaction itself. Submit flows through the
  existing token-bound handlers with the interaction value.
- Routes `progress`, `test`, `test/answer` (via `presentAssessment`):
  stop building/emitting `a2ui`; keep emitting `interaction` always.
- Delete `app/learner/question-interaction.ts` + test (its three callers
  die here; superseded by the typed prop).
- Tests: route tests assert no `a2ui` key + `interaction` present.

### T3 Performance + parent-performance plain payloads

- `server/learning/performance.ts`: return a plain `PerformanceReport`
  with **one field per current A2UI component — nothing dropped**:
  summary status, practice-evidence status + practice-detail, tests
  title + detail, guidance cards {standardCode, statusText, action
  {topicId}} + fallback text, achievements detail, fun-fact detail,
  separation-note caption. No `level`/per-skill `status` invention.
- `/performance` page: fetch + render plain cards; **keep the
  `.guidance-card` class and all copy verbatim** (e2e parity); wire the
  practice action to the existing `?practice=<topicId>` navigation.
- `app/api/parent/performance/route.ts`: build the plain payload where
  the document builder was called; `PARENT_PERFORMANCE_CHILD_CAP` stays
  in the route; **keep the phrase helper** (move beside its consumer or
  keep its module) — delete only `createParentPerformanceA2uiDocument`.
- Tests: `api/performance/route.test.ts` ports to the plain shape;
  `performance.test.ts` — carry the redaction assertion
  (`not.toMatch(/attemptId|…/score/)`), port content assertions, delete
  the four envelope-only tests with T4.

### T4 Delete A2UI + dependencies + CSS

Delete `app/src/a2ui/` (4 modules + 3 tests) and the three surface
wrappers; remove `@a2ui/react`, `@a2ui/web_core`; `pnpm install`
(lockfile clean). CSS: delete `.a2ui-column`/`.a2ui-status-*`
(styles.css ~2085–2108); **keep `.guidance-card`** and every selector
the plain renderer uses. Close workspace backlog item
`a2ui-action-schema-guards` (its channel is deleted).

### T5 Gates + e2e + smoke

`pnpm typecheck && pnpm test && pnpm lint`; run the e2e suite once
(`node e2e/run.mjs` — guidance-card locators + copy must pass
unchanged); production smoke: practice each interaction type, one
test-mode question, performance page, parent page. Record evidence.

## Verification modes

TDD: T1, T3 builders. Goal-based: T4 (grep + lockfile). Manual QA +
e2e: T5 (real artifact).

## Constraints

- One conventional commit for the phase; gates + e2e unfiltered before it.
- Copy verbatim; `.guidance-card` class parity for e2e.

## Risks

- e2e copy assertions (parent-lifecycle.spec.ts:174–252,
  performance-guidance.spec.ts) are the tightest constraint — renderer
  must reproduce copy exactly; e2e run is the guard, not grep.

## Manual QA + e2e evidence (recorded 2026-08-30)

- **e2e suite: 6/6 passed** against a production build of the plain
  renderer (temporary uncommitted `reuseExistingServer` workaround; the
  sandbox's dev-mode Turbopack fd failure is pre-existing and reproduces
  at the merge base). Covered: guidance-card locate + "Practice this
  skill" action + `?practice=` handoff, parent lifecycle journeys
  (create/reset/revoke, preview, stale-response), suggested-practice
  flow, and the performance surface copy.
- Unit gates: typecheck, 197 tests, lint green.
- Deviation note: T1's component tests were not written — the repo has no
  jsdom/testing-library component-test infrastructure; coverage comes
  from route payload tests + the full e2e pass through the real renderer.
- The e2e spec title "learner Performance renders the validated A2UI
  surface" is now historical; its assertions (copy, guidance-card class,
  action wiring) all pass against the plain renderer. Retitling deferred
  with the e2e-seeder-migration backlog entry.

## Review round 2 fixes (recorded 2026-08-30)

- Blocker fixed: the practice question heading was hidden whenever an
  interaction existed (mechanical `!a2uiDocument` → `!interaction`
  translation); now renders unconditionally, and a new e2e guard
  asserts `h2.question-text` is non-empty on the practice screen
  (6/6 e2e green against the production build after the fix).
- Also applied: dead `.a2ui-status-caution` selector + stale CSS header
  comment removed (live class names kept deliberately — recorded
  deviation from plan T4); `@a2ui` contract lines removed from
  app/AGENTS.md; orphaned `validateA2UIPayload` deleted with its test
  cases ported to the learning-payload validator; redundant topicId
  cast replaced by destructured narrowing; stale "A2UI transport
  ceiling" comment updated.
