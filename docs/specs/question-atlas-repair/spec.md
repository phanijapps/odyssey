# Question atlas repair

- **Status:** Shipped
- **Mode:** full — existing generated-data and session-state boundaries
- **Shape:** mixed
- **Source:** User request to finish the initial question graph and document technical debt
- **Context:** RFC-0009 describes the implemented atlas intent but remains Draft; this repair does not assert historical approval.

## Objective

A learner selects a reviewed skill, receives an immediately available matching bank
question or a clearly loading generated batch, and practices through the atlas's
concept and complexity structure. Answers are saved once and never call a model.
Finishing, loading, and generation failure are distinguishable in the learner UI.

## Acceptance criteria

- [x] AC1: One winning pool creation starts at most one atlas request when generation is enabled and exactly one reviewed Gold standard is resolved. The prompt contains only its standardCode/standardText and versioned constants, never learner/session data, answers or legacy topic identifiers. The completion timeout is 90 seconds, maxTokens is 16,384 and transport retries are at most one. Disabled generation makes no completion calls. A skill without bank coverage uses that batch rather than a separate single-question call.
- [x] AC2: Batch completion preserves the active assignment and accepted answers. Concurrent claims share one assignment. Late results cannot mutate a replacement pool, including switching A→B→A or ending the session.
- [x] AC3: The first atlas node is foundational regardless of input ordering. Correct answers deepen then widen when candidates exist; incorrect answers choose a fresh same-tier sibling when available. No atlas node repeats. Generated branches use concept/tier metadata; generating prerequisite edges remains outside this repair.
- [x] AC4: Invalid model envelopes fail closed; invalid nodes are pruned independently. Accepted batches and all fields are bounded, answer keys are never silently truncated, and nonempty unsafe diagrams cannot silently turn a diagram-dependent question into a text-only question.
- [x] AC5: Pending generation, unavailable questions, and completed practice have honest UI states. Pending expires after 240 seconds. Only explicit restart from an inactive terminal failed/expired/completed pool creates a new round; ordinary reads never loop generation. Progress reflects the current claimed question and expanded batch.
- [x] AC6: Answer tokens, authorization, scoring and assessment isolation retain their existing contracts. Supported reviewed composite topic identities remain answerable. Browser projections contain no answer key before submission.
- [x] AC7: Technical debt is documented with evidence and dispositions; living architecture reflects the actual workspace. Deterministic gates, production build, specialist reviews and a built browser practice journey are recorded.

## Boundaries

- Always: retain server-owned assignments, conditional session writes, generated-payload validation and isolated test data.
- Ask first: destructive data operations, deployment or charter-policy changes.
- Never: new dependencies, a new service, persistent atlas cache, new graph visualization, replacement scoring model, or rewriting frozen decisions.

## Batch and route contracts

The prompt requests 12 nodes. Input envelopes contain only `nodes`, with 4–15
entries; after independent pruning, acceptance requires 4–15 unique questions,
at least two concepts, and all three tiers. This preserves the existing partial
batch recovery threshold while making its minimum useful coverage explicit.
Each node has exactly the prompt's eight fields: concept (3–60 characters), tier
(1/2/3), question (20–400 characters and existing text validation), answer
(1–100 characters after a nonblank check, preserved verbatim), acceptableAnswers
(0–5 nonblank strings of at most 100 characters), hint (10–200 characters),
solution (2–5 nonblank strings of at most 120 characters), diagramSvg (0–20,000
characters). Nonempty SVG must survive the existing sanitizer. The JSON response
is capped at 320,000 characters. No truncation makes an invalid field valid.

`GET /api/progress` retains existing question and assignment projections:

- Ready: 200, `nextQuestion` and `poolProgress` (position, total, difficulty).
- Pending with no bank question: 200, `nextQuestion: null`, `questionPending: true`.
- Completed: 200, `nextQuestion: null`, `poolExhausted: true`, final `poolProgress`.
- Failed/unavailable with no usable bank question: 409 and the existing generic error.
- Unauthorized: existing 401; invalid reviewed selection: existing 400.
- All these responses are no-store. Internal batch identity, tree state, keys and
  provider errors are never added to browser projections.

`restart=1` requests a new round only for an inactive terminal pool of the same
skill. It never interrupts an active assignment or pending generation; duplicate
restart reads share the new pool. Ordinary reads never automatically retry a
failed batch or start another completed round. Pending state expires after
240 seconds (covering the 90-second provider request and its one transport retry),
becomes failed, and discards late completion. Polling checks that deadline before
serving further state. Disabled generation never calls the provider.

The pure walker also honors optional prerequisite ids supplied by existing core
callers; this closes a defect in the already exposed type, without extending the
generated payload or claiming a generated prerequisite graph.

## Assumptions and verification

- Technical: workspace manifests confirm `webapp`, core, AI and database packages; existing SQLite session JSON can carry additive batch/walk state without a database migration.
- Product: initial graph is interpreted as the Skill Atlas based on recent implementation commits; clarification is pending. Existing practice UI remains the surface.
- Process: the user's instruction authorizes investigation and repair through verification; separate historical RFC approval is not fabricated.
- Design/ frontend specialists are not installed; existing components and direct browser inspection provide the visual check.

## Testing strategy

TDD: generator envelope/node validation, walker policy, real SQLite route interleavings,
answer-driven selection, retry and completion. Tests fail against current code first.
Goal-based: lint, typecheck, complete deterministic suite, production build and living
documentation path checks. Visual/manual QA: built app sign-in, select skill, answer,
advance, finish, and retry while using an isolated deterministic completion endpoint.
