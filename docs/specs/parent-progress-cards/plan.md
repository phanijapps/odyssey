# Plan: Parent Progress Cards

- **Status:** Done
<!-- approver: maintainer, session approval 2026-08-18 ("continue to phase 3 and 4") -->

## Assumption trio

- **Touching:** `app/src/app/api/parent/performance/route.ts`,
  `app/src/app/api/parent/performance/route.test.ts`,
  `app/src/a2ui/parent-performance-document.ts` (export the cap constant
  only), `app/src/app/parent/page.tsx`,
  `docs/specs/parent-performance-portal/spec.md` (amend), changelog, specs
  README, this spec dir.
- **Done when:** extended route test pins `{document, children}` shape, cap,
  and redaction; gates green; Playwright records a card with real practice
  data and the reordered layout.
- **Not changing:** A2UI document compilation, `ParentSafePerformance`
  fields, guards, preview route, learner/admin surfaces, audit, schema.

## Declined patterns

- A separate `/api/parent/progress` endpoint — no second caller; the route
  already computes the data.
- `lastActive` on the cards — the portal spec's Never-do forbids exact
  activity timestamps; that is an RFC policy question, not this change.
- Keeping the prose document section below the cards — same facts twice.
- Payload versioning — client and server deploy together.
- Per-card detail navigation — no detail surface exists to navigate to.

## Resolve-vs-surface disposition record

Closed at DECIDE: all REVIEW findings resolved — the join-ordering concern applied
as a documenting comment; two nits declined with reasons (fail-fast contradicts the
spec'd graceful degradation; a child\_ redaction pattern would false-positive on
usernames containing underscores). Nothing surfaced to a human.

## Tasks

### T1 — Route returns structured children (TDD)

**Tests:** extend `api/parent/performance/route.test.ts` FIRST (red): assert
the `children` array with `{username, performance}` for the active link only
(revoked child absent), exact field set per entry, username-ascending order,
13-cap with 15 seeded links, and extend the existing redaction grep to cover
the whole body including `children`. Guard tests pass unchanged. Then
implement: export `PARENT_PERFORMANCE_CHILD_CAP` from the document module
(an acknowledged addition to that module's public API) and return
`{document, children}` from the route.

Verification: TDD (red → green) + full gates.

### T2 — Portal cards + progress-first IA (visual QA)

**Tests:** `no stub (visual QA)` — Playwright journey with a practiced child.

Subtasks, in order: (1) extract the phrase helpers from
`parent-performance-document.ts` into an exported
`formatPracticePhrases(performance)` used by both the document builder and
the page — one wording source; (2) render per-child cards (username + stat
lines + action-row with the Phase-2 inline reset/revoke) ahead of the
add-account form; zero children renders one empty-state line pointing to the
form below; (3) drop the prose progress section and the a2ui-surface render
from the page; (4) a failed performance load renders one section-level error
line and hides per-child stat lines while leaving management actions usable.

Verification: **Visual / manual QA** — recorded screenshots + card-text
assertions (practiced child shows "1 correct Practice answer"), desktop +
mobile.

### T3 — Spec amendment + records

Amend `parent-performance-portal/spec.md` — its contract line and its
implementation-status paragraph. Changelog `[unreleased-3]` Changed entry;
specs README row; spec Shipped; plan Done.

Verification: goal-based — `lint-spec-status.py` clean, `git status` clean.
