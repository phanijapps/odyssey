# Manual QA — Performance and Guidance

Recorded 2026-08-17 from the Playwright journeys in
`app/e2e/performance-guidance.spec.ts` and `app/e2e/parent-lifecycle.spec.ts`
("learner Performance renders the validated A2UI surface").

## States exercised (real built app, isolated databases)

| State                 | Evidence                                                                      |
| --------------------- | ----------------------------------------------------------------------------- |
| Loading               | `role="status"` placeholder while the document is fetched (all journeys)      |
| Empty                 | Parent-lifecycle journey: "No Practice activity is recorded yet." after retry |
| Ready                 | Guidance journey: practice skills, Test events, guidance cards render         |
| Retryable error       | Parent-lifecycle journey: 500 → `role="alert"` + Retry button → recovers      |
| Insufficient evidence | Unit: < 3 reviewed attempts → neutral "More reviewed Practice activity…"      |
| Stale action target   | Guidance journey: 8.EE.9 card honestly disables the action                    |

## Keyboard / focus / semantics (WCAG 2.2 AA manual review)

- The guidance action is a native `<button>` inside a `guidance-card` region;
  the journey focuses it programmatically, asserts focus, and activates it
  with Enter — navigation lands on the exact reviewed Practice target.
- Global `button:focus-visible` outline (3px) and semantic `h1`/`h2`/`h3`
  headings are issued by the fixed catalog; no ARIA mutation outside React.
- Narrow viewport (390×744): full-page screenshot captured and a
  no-horizontal-overflow assertion is part of the journey.

## Notes

- Test review from Performance is **not** offered: it would add a new
  view-document variant / action kind, which the spec gates behind
  "Ask first". The existing terminal Test result surface remains on the
  Practice/Test page.
- The replaced learner History panel (and `/api/history`) was removed after
  this parity review; Performance now owns the redacted timeline.
