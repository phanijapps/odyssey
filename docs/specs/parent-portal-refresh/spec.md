# Spec: Parent Portal Refresh

- **Status:** Shipped
- **Mode:** light (no risk trigger fired)
- **Owner:** Product and Engineering
- **Plan:** [`plan.md`](plan.md)
- **Related:** [parent-management](../parent-management/spec.md),
  [parent-performance-portal](../parent-performance-portal/spec.md)
- **Brief:** maintainer request, 2026-08-18 — a browser review found the
  `/parent` page renders in a dead class vocabulary (no CSS rules exist for
  `panel` / `hero` / `answer-form` / `history-list`), success feedback renders
  in error red, the reset-password form lands at the page bottom, and the copy
  speaks internal jargon. Fix the presentation and interaction mechanics.
- **Contract:** no API, route, guard, redaction, or data-shape change. The
  `/parent` page renders in the shared design language (`dash-card`,
  `primary-btn`, `secondary-btn`, `activity-list`, …), success and error
  feedback are visually distinct, destructive and password actions confirm in
  place with consequences stated, and page copy is parent language with
  correct plurals.
- **Shape:** feature

## Objective

Bring `/parent` up to the presentation and interaction standard of the rest
of the product, in two commits: (1) styling migration + accessibility
mechanics, (2) interaction mechanics + copy. Behavior, contracts, and privacy
guarantees are unchanged.

## Acceptance criteria

- [x] Every section renders with the shared design language: cards, real
      buttons, row structure — verified in-browser (computed styles), not just
      in markup.
- [x] Success feedback is visually distinct from error feedback.
- [x] `.hint` and `.eyebrow` text meets WCAG AA contrast (≥ 4.5:1) on their
      actual backgrounds; interactive targets are ≥ 40px tall.
- [x] The reset-password form opens at the child's row it belongs to, not at
      the page bottom.
- [x] Revoking uses an inline two-step confirm that states the consequence
      (child signed out everywhere, progress kept) — no native `confirm()`.
- [x] Password fields carry `autoComplete="new-password"`; submit buttons
      disable while a request is in flight.
- [x] Page and document copy is parent language: no "next-Practice evidence"
      jargon, correct plurals ("1 correct answer"), and honest zero states.
- [x] Gates green: `pnpm test`, `typecheck`, `lint`, `build`; existing route
      tests updated for the copy change, none weakened.

## Boundaries

- No API/route/guard/schema change; redaction guarantees untouched (chat
  remains 410 per parent-management).
- Per-child performance cards and any parent "interact" write-path are Phase 3+
  of the agreed strategy — out of scope here.
- Dashboard (`/dashboard`) Parents tab gets no changes in this spec beyond
  what shared CSS classes already give it.

## Testing strategy

Visual/manual QA mode: Playwright against the dev server — computed-style and
contrast probes, tap-target measurements, full create → reset → confirm-revoke
→ preview flow, screenshots recorded per state. Deterministic suites cover the
server copy change (updated anchor in
`app/src/app/api/parent/performance/route.test.ts`).
