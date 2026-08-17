# Spec: Mistake-to-Mastery

- **Status:** Implementing
- **Owner:** Product and Engineering
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** RFC-0004 (Open)
- **Brief:** none
- **Discovery:** local research synthesis, 2026-08-16
- **Contract:** learner-only `GET /api/performance/plan` returns a capped, redacted snapshot-derived plan; it accepts no learner or assessment identifier and responds `Cache-Control: no-store`.
- **Shape:** mixed

## Implementation status

The deterministic read model is implemented and delivered. It selects only the
latest completed Test, groups missed snapshot standards, counts only later
correct Practice attempts, and classifies each as `recommended`, `practicing`,
or `practice-checkpoint-met` at three correct attempts. Each item carries its
server-composed canonical Practice target; the Performance guidance card offers
that exact target through the existing Practice flow and honestly disables it
when the standard left the reviewed catalog. A regression test proves plan and
Performance reads never mutate Practice, Test, or attempt state.

## Objective

A learner who finishes a completed Test receives a small, factual plan for the
Gold standards they missed and can start the corresponding normal Practice flow.
The plan shows post-test practice evidence as a checkpoint without claiming
mastery, changing formative progress from Test results, exposing answer content,
or allowing a model to determine educational facts.

## Boundaries

### Always do

- Derive the plan from the learner’s most recent **completed** assessment,
  snapshotted Gold metadata, and redacted Practice attempts after that
  assessment.
- Scope every read to the server-derived learner identity and return
  `Cache-Control: no-store`.
- Preserve assessment/practice isolation: Tests never write Practice mastery,
  adaptive level, memory, or graph beliefs.
- Use supportive server-owned template wording that states its evidence.

### Ask first

- Introducing a formal mastery definition or reassessment rule.
- Introducing parent/guardian sharing, a parent role, or a linked-child model.
- Adding reviewed prerequisite relations to Gold and using them for plan order.
- Sending any performance/assessment projection to Pi for prose generation.

### Never do

- Infer prerequisites from standard code order, model output, or the optional
  diagnostic graph.
- Return raw answers, question text, answer keys, hints, solutions, assignment
  tokens, provider prompts, or an arbitrary child/assessment scope.
- Persist a second source of truth for plans, mastery, or test evidence.
- Treat a practice checkpoint as a provider score, diagnosis, or mastery claim.

## Testing Strategy

- **TDD:** pure plan grouping, snapshot-to-topic mapping, state classification,
  redaction, and sparse/stale data rules have deterministic invariants.
- **Integration:** learner-scoped repository/API queries prove Test isolation,
  latest-completed selection, snapshot stability, and no-store headers.
- **Visual/manual QA:** a learner completes a Test, opens Performance, starts a
  recommended Practice skill, and sees the checkpoint update without a Test
  changing Practice mastery.

## Acceptance Criteria

- [x] Given no completed Test, when a learner requests their plan, they receive
      an empty positive state and no assessment internals.
- [x] Given a completed Test with incorrect questions, when the plan loads, it
      contains exactly one item per missed snapshotted Gold record with the correct
      answered/incorrect baseline.
- [x] Given a partial Test, when a plan is computed, the partial Test is not a
      plan source.
- [x] Given later Gold edits, when a plan for an earlier Test is computed, its
      target uses that Test’s snapshotted standard metadata and fingerprint.
- [x] Given post-Test Practice for a target, when the plan loads, it reports
      `recommended`, `practicing`, or `practice-checkpoint-met` from documented
      post-baseline evidence only.
- [x] Given any Test result, Practice progress, adaptive level, memory, and
      graph beliefs remain unchanged until the learner submits normal Practice.
- [x] Given a learner-scoped request, the response contains no raw answer,
      question, solution, token, prompt, unscoped child ID, or provider data and is
      not cacheable.
- [x] Given a plan item, the learner can enter existing Practice for exactly its
      validated Gold standard without a client-invented composite topic identity.
- [x] Given fewer than the stated evidence threshold, the UI says checkpoint
      status rather than mastery, diagnosis, ability, or prerequisite.

## Assumptions

- Technical: completed assessment rows snapshot Gold content/fingerprint and
  remain isolated from formative progress (source: test-mode-assessment spec).
- Technical: existing Practice attempts retain child/topic/correct/timestamp
  but not raw answer content (source: learning repository).
- Product: v1 is learner self-view; parent linkage is excluded (source:
  provisional research recommendation; requires approval before implementation).
- Product: a checkpoint means at least three correct post-assessment Practice
  attempts for the same target; it is not mastery (source: provisional research
  recommendation; requires approval before implementation).
