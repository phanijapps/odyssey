# Spec: test mode assessment

- **Status:** Implementing
- **Owner:** Example User
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** ADR-0001, ADR-0002, ADR-0003
- **Brief:** none
- **Discovery:** none
- **Contract:** none
- **Shape:** mixed

> **Spec contract:** this document defines what "done" means. The implementing
> PR must match this spec, or update it. Verification must be derivable from it.

## Objective

A learner uses Practice as a supportive, adaptive tutor for one skill and uses
Test as a focused, mixed-skill assessment. Practice provides immediate guidance
and adjusts to the learner's answers. Test lets the learner select reviewed
skills, presents a stable nine-question assessment without formative answers,
and saves a resumable result that is separate from practice mastery. The
existing calm, question-first learner surface makes the active mode, next action,
and assessment progress understandable at a glance.

## Boundaries

### Always do

- Keep all question selection limited to reviewed Gold curriculum and derive the
  authenticated learner from the server-owned session.
- Keep Practice feedback and adaptive progression intact; persist test attempts
  and results separately from practice learning records.
- Validate selected standard identifiers, answer submissions, generated question
  payloads, and every database write at the server boundary.
- Prefetch at most the next assigned test question and retain the assigned
  question server-side before it is shown.

### Ask first

- Add an AI provider, Pi extension, MCP capability, agent tool, model
  credential, external service, or dependency.
- Change whether assessment attempts influence practice mastery or parent
  reporting.
- Change the fixed test length, scoring policy, or the maximum selected skills.

### Never do

- Send learner data to an MCP, autonomous subagent, or provider not already
  configured for the bounded server-side question adapter.
- Reveal a test question's correct answer, hint, or solution before its test is
  complete.
- Trust client-provided topic or score data, store a learner's raw answer, or
  let generated content choose authorization, persistence, or curriculum.
- Create a separate deployable service, new top-level directory, or speculative
  agent abstraction.

## Testing Strategy

TDD covers deterministic test-blueprint allocation, selection validation,
server-owned answer binding, scoring, test persistence/resume, and the
Practice/Test data boundary. Route integration tests exercise authenticated start,
next-question, answer, and completion paths against SQLite. Visual/manual QA
exercises both real browser journeys: Practice immediate tutoring and a
multi-skill Test with no formative disclosure, reload/resume, completion, and a
clear result report. Typecheck and build verify the Next.js integration.

## Acceptance Criteria

- [ ] Given a learner chooses Practice and one reviewed skill, when they submit
      an answer, the application immediately shows correctness, an appropriate
      hint or solution, and an adaptive next practice question; this flow remains
      separate from an active or completed test.
- [ ] Given a learner chooses Test, when a learner-role session selects one to
      three unique Gold record IDs from the current subject and grade and starts,
      the application resolves and snapshots those records once and creates or
      resumes that learner's sole server-owned nine-question assessment. Its skill
      assignments rotate in selection order, its difficulty plan is
      `1,1,1,2,2,2,3,3,3`, and no question text repeats within the assessment.
- [ ] Given an active test, when a learner answers a question with its
      server-issued opaque assignment token, the server atomically grades only
      that retained unanswered assignment and records its server-calculated score.
      Before completion, including on a duplicate submission, its response shows
      no correct answer, hint, solution, formative correctness, or per-question
      points.
- [ ] Given a learner reloads during an active test, when they return while their
      authenticated session remains valid, the application resumes the same
      selected Gold records, unanswered retained question and assignment token,
      answered positions, and score. A replay for an answered assignment does not
      change the score or grade the next assignment even when it is ready, and
      does not disclose formative feedback.
- [ ] Given a learner completes all nine test questions, when the result screen
      appears, it shows the total score out of 180, each question's correctness
      and points, and the correct answer and solution for review; it never shows
      the learner's submitted response. The completed test remains available only
      to its learner through the active session.
- [ ] Test attempts and scores persist separately from `learning_progress`,
      practice attempts, learning-memory signals, and mastery beliefs; test
      submission cannot change Practice adaptive level or streak.
- [ ] Invalid, duplicate, foreign, unavailable, cross-subject/grade, or
      more-than-three Gold-record selections are rejected before a test is
      created. Every start and answer mutation proves the same-site authenticated
      learner-role session before reading or writing state; an answer object accepts
      only its non-empty `answer` field of at most 100 characters and cannot select
      or substitute its topic, score, difficulty, or question.
- [ ] Given supported selected Gold records, when the learner advances to an
      assigned test question, the server serves a retained prefetched question
      when ready and otherwise generates only the current assigned question. It
      resolves selected records once at creation, scans no curriculum records on
      advance, prepares at most the current and next assignments, does not
      duplicate concurrent preparation, retains every finalized question through
      completion review, and persists each question's Gold record ID, Gold content
      fingerprint, generator content version, validation-schema version, and
      validation outcome before display. A failed current assignment remains
      retryable without advancing the assessment.
- [ ] The Test setup, active-test, resume, completion, loading, and unavailable
      states are keyboard-operable, visibly focused, and distinguish Test from
      Practice through their heading, instructions, feedback timing, and locked
      skill selection.
- [ ] Given an active test, when the learner confirms Exit test, the server marks
      it `partial`, records its exit time and score-to-date, retains its answered
      question review, and permits a new test without resuming the partial one.
- [ ] Given a learner opens History, when practice attempts and completed or
      partial tests exist, the application shows a learner-scoped chronological
      log of both kinds with their outcome summaries; test records remain excluded
      from Practice mastery and adaptive progression.

## Assumptions

- Technical: the learner UI is a single Next.js page and routes currently expose
  only internal browser-facing endpoints (source: `app/src/app/page.tsx` and
  `app/src/app/api/`; no published API contract exists).
- Technical: SQLite is the local source of truth and the application owns
  persistence in the one Next.js process (source:
  `docs/architecture/reference.md`).
- Technical: the current Pi adapter is server-only, bounded to registered
  learning actions, and model output is untrusted (source:
  `docs/architecture/reference.md`).
- Product: Test uses end-only feedback, nine questions, a 180-point maximum,
  one-to-three selected skills, and no effect on Practice mastery (source: user
  confirmation 2026-08-16).
- Product: AI curation is a future extension point, not a present Pi extension,
  MCP, or subagent capability (source: user confirmation 2026-08-16).
- Process: this is a full-mode mixed user-facing, persistence, and security
  boundary change; the repository's required base-freshness and loop-engine
  scripts are absent, so the documented state-machine gates cannot run (source:
  `AGENTS.md`; `scripts/` absent on 2026-08-16).
- Design: the repository has no installed experience-design pack or grounded
  aesthetic-direction document; the existing calm, question-first learner
  surface is the available design reference (source: available skills roster;
  `app/src/app/page.tsx`).
