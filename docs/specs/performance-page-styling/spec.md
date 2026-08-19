# Spec: Performance Page Styling

- **Status:** Shipped
- **Mode:** light (no risk trigger fired — cosmetic migration, same fix
  class as `parent-portal-refresh`, single surface)
- **Owner:** Product and Engineering
- **Plan:** none (single-task lean spec; task list below)
- **Related:** [parent-portal-refresh](../parent-portal-refresh/spec.md)
- **Brief:** maintainer report, 2026-08-18 — `/performance` has the same
  formatting problem the parent portal had: it renders in the dead class
  vocabulary (`panel`, `brand`) with no container, verified in-browser
  (section: transparent bg, 0 border, 0 padding, full-bleed).
- **Contract:** rendering-only change. `GET /api/performance` and the A2UI
  document are untouched; the learner performance e2e assertions (error
  copy, Retry, document headings) pass unchanged.
- **Shape:** fix

## Objective

Migrate `/performance` to the shared design language and share one page
container with the parent portal (`.parent-page` renamed to the neutral
`.narrow-page`, used by both).

## Acceptance criteria

- [x] The page renders in a centered max-width container with the content
      in a card (white bg, border, radius) — verified in-browser via
      computed styles, not markup alone.
- [x] The topbar wordmark matches the parent portal's (`wordmark` +
      `small-mark`); no ghost classes remain on the page (`panel`, `brand`
      gone; grep-pinned).
- [x] Error and loading states use the shared classes (`error-text`,
      `primary-btn` Retry, `result-meta`) — Retry is visibly a button.
- [x] No mobile overflow at 390px; gates green (`pnpm test` / `typecheck` /
      `lint` / `build` / `test:e2e` — the learner performance journey is
      the regression net, per K-0004).

## Task list

- T1: rename `.parent-page` → `.narrow-page` in styles.css (+ scoped
  `.stack` rule), update `app/src/app/parent/page.tsx`; migrate
  `app/src/app/performance/page.tsx` (topbar wordmark, `narrow-page`
  container, `dash-card` section, shared error/loading classes). Verify:
  gates + e2e + before/after Playwright screenshots with computed-style
  probes.

## Boundaries

- No API, A2UI document, guard, or copy changes; the parent portal's
  rendering is unchanged apart from the class rename.
