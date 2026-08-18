# Plan: Parent Portal Refresh

- **Status:** Done

## Assumption trio

- **Touching:** `app/src/app/parent/page.tsx`, `app/src/app/styles.css`,
  `app/src/a2ui/parent-performance-document.ts`,
  `app/src/app/api/parent/performance/route.test.ts` (anchor copy update),
  `docs/specs/README.md`, `docs/product/changelog.md`, this spec dir.
- **Done when:** gates green (`pnpm test` / `typecheck` / `lint` / `build`)
  and Playwright QA records the ACs: computed styles show cards/buttons,
  contrast ≥ 4.5, targets ≥ 40px, reset form opens at the row, revoke is an
  inline two-step, success ≠ error styling.
- **Not changing:** API routes/guards/shapes, redaction, learner portal,
  dashboard, auth, schema, chat policy.

## Declined patterns

- Extracting `ParentChildRow` / `NoticeBanner` components — one caller each;
  the page stays a single file.
- New design tokens or a portal CSS layer — reuse existing classes; ≤ ~10
  scoped lines added.
- Per-child performance cards — server shape change, that is Phase 3.
- Client-side validation library — native HTML5 messages already fire
  client-side with no request.
- Refactoring the A2UI document shape — copy strings only.

## Tasks

### T1 — Styling migration + a11y mechanics (Phase 1) — Complete

Verification: **Visual / manual QA** (`no stub (visual QA)`).

Migrate `page.tsx` to the shared vocabulary: `wordmark` + `small-mark`
topbar, `dash-card` sections with `section-title` headings, `stack` forms,
`primary-btn` / `secondary-btn` / `clear-btn` buttons, `activity-list` /
`activity-item` rows, `result-meta` loading, `empty-state` empties,
`success-box` / `error-text` notice (kind state). Add `autoComplete`
(`new-password` / `off`), pending-disable on create/reset, and scoped CSS:
`.parent-page` container, `.action-row` (+ `margin-top: 0` resets), scoped
`.stack` top margin. Fix `.hint` (#859189 → #637169) and `.eyebrow`
(#718078 → #5f6d64) contrast. Commit.

### T2 — Interaction mechanics + copy (Phase 2) — Complete

Verification: **Visual / manual QA** (`no stub (visual QA)`), plus updated
deterministic anchor.

Reset form renders inside the owning child's row; revoke becomes inline
two-step confirm with consequence copy (drop `window.confirm`); per-surface
error state replaces the global `message`; explicit `origin` header on
mutations (dashboard idiom). Copy pass client-side (hero, headings, hints,
empty states) and server-side in `parent-performance-document.ts` (plurals,
zero-streak wording, summary sentence) + anchor test update. Commit.

### T3 — Records — Complete

Verification: **Goal-based check** — `lint-spec-status.py` clean, `git status`
clean, changelog + specs README updated. `no stub (goal-based)`.
