# RFC-0005: Define parent interaction

- **Status:** Accepted
- **Date:** 2026-08-18

## Decision

Maintainer, 2026-08-18: build **A — suggested practice** (A alone). Day-
granularity recency ("last practiced: N days ago") is **accepted** on the
parent surface. The parent write-path is audited via a **separate audited
table** beside `parent_relationship_events` (no ledger rebuild).
**Templates only** — no free-text parent→child content, confirmed as
standing policy. B and C were not selected (B may return as a follow-up;
C's recency half was accepted independently of the recap view).

## Summary

The parent portal is read-only by design: parents see aggregate progress,
preview recommended practice, and manage accounts. The maintainer's original
ask — "parents view their kids progress **and be able to interact**" — is
half-answered. This RFC proposes which interactions to add, and names the two
policy lines any choice crosses.

## Problem

"Interact" currently means account administration. Every engagement path a
parent would actually want is closed, some by deliberate safety boundary
(`parent-performance-portal`), some simply unchosen:

- A parent who sees "3 skills recommended" cannot act on that information
  with their child through the product.
- The portal's Never-do line blocks exact activity timestamps, so cards
  cannot say "last practiced: 2 days ago" — recency is the single most
  requested parent fact after progress itself.
- The audit ledger (`parent_relationship_events`) has a fixed event-type
  CHECK and a NOT NULL child leg, so any parent-initiated write needs an
  explicit audit decision before a schema change.

## Options

### A — Suggested practice

The parent sees each child's already-recommended skills (the same
mistake-to-mastery items the preview exposes today, same redaction) and
marks one as "practice together tonight". The child's portal shows it as a
suggestion from their parent; practicing it uses the existing learner flow —
the suggestion itself never mutates mastery, attempts, or streaks.

- Value: highest — turns observation into the one action the product exists
  for.
- Cost: schema (assignment rows with lifecycle), two routes, both UIs,
  guards + tests. Moderate.
- Risks: a parent write-path (audit decision needed); pressure-to-perform
  dynamics if suggestions are conspicuous — mitigated by child-side opt-in
  framing and quiet dismissal.

### B — Template encouragement notes

On a checkpoint event, the parent picks from a fixed set of canned
encouragements; the child sees it on next visit. Templates only — no free
text, so no moderation surface.

- Value: moderate; cheap.
- Cost: small (rows + two UIs).
- Risks: minimal by construction.

### C — In-app weekly recap

A "this week" summary view (days practiced, skills advanced) generated
locally at read time. No write path at all.

- Value: moderate.
- Cost: small, but it requires relaxing the Never-do line on activity
  timestamps from "exact timestamps" to day-granularity recency — a privacy
  policy change, not an engineering one.

### D — Status quo

Keep the portal read-only + preview. Defensible; the preview already gives
the parent a way to engage offline.

## Recommendation

**A, with B as a follow-up.** A reuses exposure the product already grants
(the preview shows the same standard and sample), rides the existing learner
practice flow for all mutation, and answers the maintainer's ask directly.
C's timestamp relaxation is worth deciding independently — day-granularity
recency ("last practiced: 2 days ago") on the progress cards is high-value
and, if accepted, should be its own small spec. If A is rejected, D over a
watered-down A.

Guardrail either way: the existing backlog item
`a2ui-action-schema-guards` must land with (or before) any parent action
surface.

## Decision asked of the maintainer

1. Which option (A / B / C / D or a combination)?
2. May the portal show day-granularity recency ("last practiced: 2 days
   ago"), relaxing the "exact activity timestamps" Never-do to that extent?
3. Audit policy for parent-initiated writes: extend
   `parent_relationship_events` (schema rebuild) or a separate audited
   table alongside it?
4. Confirm: no free-text parent→child content in any option (templates
   only)?

## Consequences

Accepting A produces a spec under `docs/specs/` and a schema migration;
accepting the recency relaxation amends `parent-performance-portal`'s
Never-do line in the same change; rejecting everything closes this RFC with
the read-only stance recorded as final.
