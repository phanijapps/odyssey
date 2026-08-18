# Code review — parent-progress-cards (full mode, round 1)

Reviewer: adversarial-reviewer (dispatched subagent), 2026-08-18.

- Blockers: none.
- Concern (card join race): resolved as a documenting comment at the join
  site — both projections derive from the same username-ascending
  `listParentChildren` query.
- Nit (fail-fast on missing `children`): declined — graceful degradation is
  the spec'd behavior (AC3); the contract is pinned server-side by the
  route test's exact-shape `toEqual`.
- Nit (`child_` in the redaction regex): declined — `child_` is a legal
  username substring and would false-positive; `childId` covers the actual
  field-name leak vector.

Verdict after dispositions: **Clean — ready to commit.**
