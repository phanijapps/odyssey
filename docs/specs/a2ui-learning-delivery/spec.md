# Spec: A2UI Learning Delivery

- **Status:** Shipped
- **Owner:** Product and Engineering
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** RFC-0004 (Open)
- **Brief:** none
- **Discovery:** A2UI primary documentation and local learning architecture, 2026-08-16
- **Contract:** learner Performance uses a validated HTTP `GET /api/performance` envelope. The current catalog is local-only: `OdysseyColumn`, `OdysseyText`, and `OdysseyStatus`; it has no functions, bindings, data model, or actions.
- **Shape:** mixed

## Implementation status

All tasks are complete. Practice and Test issue server-selected text,
multiple-choice, and true-false interactions through the fixed A2UI v0.9.1
catalog with token-bound submits; the learner and parent Performance
documents render read-only through the same validated catalog. Delivery was
verified live (radio-group submission and grading observed in the browser)
plus the recorded journeys and unit suites.

## Objective

Odyssey renders dynamic learning interactions through A2UI v0.9.1 while keeping
assessment and Practice authority on the server. Learners receive server-issued
multiple-choice, true/false, and text-response questions through an Odyssey
A2UI catalog; the renderer reports a validated response to existing token-bound
answer APIs. Performance receives dynamic evidence-backed insight surfaces.
A later parent portal consumes the same read-only catalog only after parent↔child
authorization exists.

## Boundaries

### Always do

- Pin the stable A2UI v0.9.1 protocol and validate every server/client envelope
  against the supported Odyssey catalog and renderer capabilities.
- Map A2UI to fixed accessible React components styled with the existing
  Practice/Test visual language.
- Keep question selection, assignment token, timing, answer validation,
  grading, score, scope, and navigation authorization server-owned. Pi may
  propose an interaction type only through a strict structured schema; the
  server accepts it only when it is allowed by the current Practice/Test policy.
- Support `multiple-choice`, `true-false`, and `text-response` as explicit
  versioned item interaction types, each with a server-defined response schema.

### Ask first

- Adding catalog components/functions, two-way data synchronization, streaming,
  custom renderer code, images/media, rich text/Markdown, arbitrary links,
  client-side scoring, or model-authored actions.
- Introducing a parent role, relationship/revocation model, parent portal, or
  parent-visible assessment data.
- Adding any A2UI transport other than the approved HTTP request/response and
  explicit action-post flow.

### Never do

- Render an unregistered component/function, execute A2UI-supplied code, or
  permit arbitrary data-model path/action arguments to reach a mutation.
- Trust a client-selected or unvalidated model-selected question type,
  assignment, correct answer, score, learner ID, form, standard, or Performance fact.
- Put answer keys, solutions, tokens, raw child data, or provider prompts into
  a Performance/parent A2UI surface.
- Use Pi output as an A2UI authority; Pi output remains optional bounded prose
  that is validated and attached only to already-derived evidence.

## Testing Strategy

- **TDD:** catalog allowlist/parser, action argument mapping, response schemas,
  question interaction state, and unsupported capability behavior.
- **Integration:** server-issued question to A2UI surface to action post to
  token-bound grade; replay/stale/tampered actions; renderer authorization;
  Performance redaction; parent isolation after the later auth foundation.
- **Visual/manual QA:** keyboard-only multiple-choice, true/false, and text
  response; screen-reader labels/error states; narrow viewport; Performance
  insight load/retry; parent portal only after linked-child fixtures exist.

## Acceptance Criteria

- [x] Given a server-issued Practice or Test assignment, its A2UI surface has
      exactly the interaction type and options/text constraints selected by the
      server and no correct-answer material.
- [x] Given a multiple-choice response, true/false response, or text response,
      when the learner submits, the existing opaque assignment token binds the
      response to exactly one server-owned question and replay/stale/tampered
      actions cannot grade another question.
- [x] Given an unsupported A2UI component, function, binding, capability, or
      protocol version, the server/client rejects it safely and renders a recovery
      state without executing or silently dropping content.
- [x] Given keyboard or assistive-technology use, each interaction has semantic
      labels, selection/error feedback, focus order, and no pointer-only action.
- [x] Given an A2UI Performance insight, it derives only from the redacted
      server evidence projection, carries an allowed action, and cannot mutate
      mastery or assessment state merely by rendering.
- [x] Given parent portal delivery, it is unavailable until a durable
      parent↔child relationship, revocation policy, and server-scoped read contract
      are implemented and tested. (Delivered by the shipped
      parent-performance-portal spec: durable links, revocation enforced on
      every read, and the parent-scoped read contract.)
- [x] Given current non-A2UI Practice/Test surfaces, they continue to work until
      an explicitly approved migration/parity gate removes them.

## Assumptions

- Technical: A2UI v0.9.1 is current stable and its React renderer is stable;
  `@a2ui/react` uses `@a2ui/web_core` for protocol state/data binding (source:
  https://a2ui.org/guides/client-setup/ and https://a2ui.org/specification/v0.9.1-a2ui/).
- Technical: A2UI separates declarative components, actions, renderer/client,
  and agent/server; the client renderer owns styling (source:
  https://a2ui.org/introduction/what-is-a2ui/).
- Product: dynamic Performance insights and question types use A2UI; the agent
  proposes an allowed question interaction, while Test policies conform to the
  same catalog styles (source: user confirmation 2026-08-16).
- Product: parent portal is desired but its identity/link/revocation policy is
  not yet defined (source: user direction; requires approval before execution).
