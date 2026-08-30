# RFC-0006 phase 5 — one question-selection path

**Status:** Shipped
**Mode:** light (behavior-preserving deletion; caller set exhaustively verified)
**Contract of record:** [`docs/rfc/0006-simplify-to-persona-app.md`](../../rfc/0006-simplify-to-persona-app.md) Phase 5.

## Objective

Retire the overlapping half of the question-selection surface: agent.ts's
position-indexed fixture API (`requestLearningFixture` + the three
`getLearningFixture*` getters) and its duplicate `checkAnswer` have zero
production callers — the live path is adaptive-pool's bank matcher plus
agent.ts's Ollama completion boundary. After this phase, adaptive-pool is
the single selection engine and agent.ts is purely the bounded
completion/validation boundary.

## Acceptance criteria

- [x] AC1: `requestLearningFixture`, `getLearningFixtureExpectedAnswer`,
      `getLearningFixtureAcceptableAnswers`, `getLearningFixtureHint`,
      `checkAnswer`, and `getQuestionByIndex` are gone from production code
      with their tests; grep shows no references.
- [x] AC2: adaptive-pool's exports and behavior are unchanged; the
      Ollama boundary (`requestOllamaLearningQuestion`, `isOllamaConfigured`,
      validation helpers) is unchanged.
- [x] AC3: gates green; e2e 6/6 on the production build (practice
      question path is e2e-covered).

## Testing strategy

Existing suite + e2e; no new tests (pure deletion of dead surface;
behavior preservation is the test).

## Assumptions

- learning.ts's `checkAnswer` (unit-suffix-aware) is the canonical
  grader — confirmed by grep (agent's copy has no caller, not even a
  test).
