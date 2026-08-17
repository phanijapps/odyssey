# Spec: Performance and Guidance

- **Status:** Draft
- **Owner:** Product and Engineering
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** RFC-0004 (Open); `mistake-to-mastery` (Draft)
- **Brief:** none
- **Discovery:** local UI, privacy, and assessment research, 2026-08-16
- **Contract:** none while Draft; implementation defines a versioned internal BFF contract
- **Shape:** mixed

## Objective

Performance is a dedicated learner page that makes recent Practice and terminal
Test evidence understandable without changing the established Practice/Test
layout or confusing formative progress with assessment results. It provides
calm, factual next-step guidance from the Mistake-to-Mastery projection through
a validated A2UI v0.9.1 surface rendered through Odyssey’s fixed React catalog.

## Boundaries

### Always do

- Keep Practice evidence, completed/partial Test events, and guidance visibly
  separate and clearly labelled.
- Render a loading, empty, insufficient-evidence, ready, and retryable-error
  state with keyboard-accessible fixed React components.
- Derive every fact, qualitative state, action target, and child scope on the
  server; validate the complete A2UI envelope, catalog component, data binding,
  and action before returning it.
- Use evidence-aware, supportive wording and direct actions only from a closed
  action catalogue.

### Ask first

- Adding a parent role, relationship model, multi-child chooser, or sharing
  child Performance with another account.
- Adding Pi-generated prose, new analytics/telemetry, persistent performance
  summaries, or a new third-party UI dependency. V1 guidance is deterministic;
  Pi prose is deferred until a measured need and safe-schema review exist.
- Adding a new view-document variant, action kind, or any content that includes
  answer/question data.

### Never do

- Permit raw model output, unregistered A2UI components/functions, arbitrary
  URLs, HTML, Markdown, CSS, SVG, scripts, or client-selected mutation events.
- Expose raw answers/questions, expected answers, hints, solutions, tokens,
  exact event timestamps, provider data, or another learner’s evidence.
- Calculate mastery, assessment score, or guidance in the browser.
- Blend Test score into Practice accuracy/level or claim a provider result.

## Testing Strategy

- **TDD:** view-document parser, evidence thresholds, action allowlist, and
  redaction have compact deterministic rules.
- **Integration:** Performance query/route proves learner scope, no-store,
  separated data, unknown-view rejection, and no mutable side effects.
- **Visual/manual QA:** learner navigates from the existing layout to
  Performance at desktop and narrow viewport, observes empty/ready/error
  states, opens a Test review, and starts an approved Practice action.

## Acceptance Criteria

- [ ] Given the learner layout, when the learner chooses Performance, a distinct
      page opens without changing current Practice or Test layout/style contracts.
- [ ] Given sparse or no evidence, when Performance loads, it shows a factual
      neutral state and no accuracy, deficiency, mastery, or comparison label.
- [ ] Given sufficient Practice evidence, when Performance loads, it shows a
      bounded server-computed activity/skill projection with evidence status and no
      raw attempt or question data.
- [ ] Given terminal Tests, when Performance loads, completed and partial Test
      events appear separately from formative Practice evidence and state that Tests
      do not alter Practice mastery.
- [ ] Given Mistake-to-Mastery targets, when Performance loads, it renders only
      the validated closed guidance variants and their validated internal actions.
- [ ] Given an unknown/malformed view document, when the route or renderer sees
      it, it rejects it safely and shows a retryable fallback; it never silently
      ignores unknown fields or renders arbitrary content.
- [ ] Given a learner session, when Performance data is requested, it is scoped
      to that learner, `Cache-Control: no-store`, capped, redacted, and read-only.
- [ ] Given a valid Practice action, when selected, it opens the matching
      existing Practice target; invalid/stale actions cannot select another target.
- [ ] The ready, loading, empty, insufficient-evidence, and failure states meet
      WCAG 2.2 AA keyboard/focus/semantic requirements in manual review.

## A2UI protocol decision

Performance uses A2UI **v0.9.1**, the current stable protocol/release documented
at <https://a2ui.org/specification/v0.9.1-a2ui/>. Its renderer dependencies are
recorded in RFC-0004 before installation. V1 uses HTTP request/response surfaces
and explicit server action posts; SSE/streaming is deferred until an actual
progressive-insight use case requires it. The approved catalog contains only
Odyssey `Text`, `Card`, `List`, `ChoicePicker`, `TextField`, `Button`, and
semantic status components mapped to fixed React components. True/false is a
`ChoicePicker` restricted to exactly two server-issued choices.

## Assumptions

- Technical: History already returns a redacted learner-scoped projection and
  terminal assessment summaries (source: history route/service).
- Technical: A2UI v0.9.1 has a stable React renderer and uses a component
  catalog, action, and data-model protocol (source: https://a2ui.org/guides/client-setup/).
- Technical: Pi AI remains a bounded stateless completion boundary; it is not
  an A2UI renderer or authority (source: architecture application reference).
- Product: v1 is learner self-view/admin demo; genuine parent linking is
  excluded (source: provisional research recommendation; requires approval).
- Product: Performance uses official A2UI v0.9.1 with an Odyssey allowlisted
  React catalog; its v1 insights are deterministic rather than Pi-authored
  (source: user confirmation and engineering judgment, 2026-08-16).
