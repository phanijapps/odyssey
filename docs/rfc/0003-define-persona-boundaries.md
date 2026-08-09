# RFC-0003: Define persona boundaries

- **Status:** Accepted
- **Date:** 2026-08-09

## Decision

Odyssey has three human personas: Learner, Parent/Guardian, and Curriculum
Steward. Learners practice only their assigned curriculum; Parents/Guardians
view their child’s progress and ask bounded questions; Curriculum Stewards
submit sources and approve Silver-to-Gold promotion. Two separate Pi agents are
system roles, not user personas: an extraction agent creates Silver candidates
and a formalization agent creates Gold drafts from approved Silver.

## Consequences

Each screen, route, and action declares its intended persona. Human approval is
required for Silver-to-Gold promotion; no agent is granted approval authority.
