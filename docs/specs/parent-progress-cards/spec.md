# Spec: Parent Progress Cards

- **Status:** Shipped
<!-- approver: maintainer, session approval 2026-08-18 ("continue to phase 3 and 4") -->
- **Mode:** full (risk trigger: public-interface change — the performance
  route's response shape gains a field)
- **Owner:** Product and Engineering
- **Plan:** [`plan.md`](plan.md)
- **Related:** [parent-portal-refresh](../parent-portal-refresh/spec.md),
  [parent-performance-portal](../parent-performance-portal/spec.md)
- **Brief:** maintainer-approved strategy Phase 3, 2026-08-18 — the portal's
  progress view becomes one card per child (progress-first IA), fed by the
  same redacted aggregates the A2UI document already carries.
- **Contract:** `GET /api/parent/performance` (parent session, no-store)
  returns `{ document, children }`. `children` is derived server-side from
  active links (the route still accepts no child identifier), ordered by
  username ascending (the `listParentChildren` order), capped at the same
  13-child cap as the document — entries beyond the cap are omitted from
  both projections, exactly as the document truncates today, and no
  truncation flag is added — and each entry carries `username` plus exactly
  the existing `ParentSafePerformance` aggregate fields: the same fields
  already compiled into the document, a second projection of the same
  evidence, with no new evidence kinds and in particular no ids, no standard
  codes, no timestamps. The `/parent` page renders one card per child
  (username, pluralized practice and test facts, next-practice line) with
  the account actions inline, ahead of the add-account form; the standalone
  prose progress section is removed from the page while the route keeps
  issuing the unchanged A2UI document.
- **Shape:** feature

## Objective

Make progress the primary parent view: each child's aggregate practice/test
facts on one scannable card, management secondary. No new evidence kinds, no
new inputs, no privacy-boundary change.

## Acceptance criteria

- [x] `GET /api/parent/performance` returns a no-store `{ document, children }`
      body; `children` entries are `{ username, performance }` with exactly
      the `ParentSafePerformance` field set, ordered by username ascending,
      capped at 13 (entries beyond the cap omitted from both `children` and
      the document's child components, no truncation flag), derived only
      from active links; the `document` is compiled exactly as before.
- [x] A parent session sees one card per child ordered before the add-account
      form; each card shows the child's username, the same pluralized phrases
      as the document ("1 correct Practice answer" / "N correct Practice
      answers", "no Practice streak yet" / "N-day Practice streak", "1
      checkpoint met" / "N checkpoints met"), tests completed/partial, and
      the next-practice line; reset/revoke expansions work inside the card.
      With zero children, the cards section renders one empty-state line
      pointing to the add-account form below it, and no cards.
- [x] A failed performance load leaves the cards' management actions usable:
      one section-level error line renders, and per-child stat lines are
      hidden (no partial or stale stats).
- [x] The response greps clean for
      `accountId|childId|topicId|standardCode|assignmentToken` and introduces
      no timestamp or identifier fields.
- [x] `parent-performance-portal` is amended in the same change — its
      contract line and its implementation-status paragraph — with no other
      spec drift.
- [x] Guard behavior is unchanged: anonymous 401, learner 403, no-store on
      every path (the redaction test is extended to cover `children`; the
      guard tests pass unchanged).
- [x] Gates green (`pnpm test` / `typecheck` / `lint` / `build`) and a
      recorded visual QA run shows a card with real practice data.

## Boundaries

- **Always do:** derive the children array from the same
  `listParentChildren` + `learnerScopeKeyForUsername` + `getParentSafePerformance`
  pipeline that feeds the document — one source, two projections.
- **Ask first:** anything adding new evidence kinds (last-active, topic
  breakdowns, scores) — those cross the portal spec's Never-do boundaries and
  belong to the parent-interaction RFC, not here.
- **Never do:** add timestamps or identifiers to the parent payload; accept a
  child identifier as input; drop or alter the A2UI document contract; touch
  learner/admin surfaces.

## Testing strategy

- **TDD:** extend `api/parent/performance/route.test.ts` first — assert the
  `children` array shape, cap at 13, active-link-only derivation, and the
  unchanged redaction grep; then implement the route change.
- **Integration:** the existing anonymous/learner guard assertions continue
  to pass unchanged.
- **Visual / manual QA:** Playwright against the dev server — create a child
  via the portal, answer one practice question as the child, reload the
  parent portal, record the card text ("1 correct answer") and layout
  (cards above the add form), desktop + mobile.

## Assumptions

- Client and server deploy together (local-first app) — the payload needs no
  version negotiation; the page can rely on `children` being present.
- The 13-child cap parity is intentional: card list and document describe the
  same set.
