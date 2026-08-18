# Spec: Parent Performance Portal

- **Status:** Shipped
- **Owner:** Product and Engineering
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** RFC-0003; RFC-0004 (Open); `performance-guidance` and `a2ui-learning-delivery` (Draft)
- **Brief:** none
- **Discovery:** current persona/auth boundary and Performance research, 2026-08-16
- **Contract:** relationship administration is local-only: `GET`/`POST /api/parent/children` and `PATCH`/`DELETE /api/parent/children/:accountId` derive scope from a parent principal and active link. First-parent bootstrap is available only under explicit configuration. In production, `ODYSSEY_ENABLE_PRODUCTION_PARENT_BOOTSTRAP=1` plus the configured parent credentials can seed one parent only while no parent account exists; it has no public route and cannot reset an existing parent. Relationship creation, password reset, and revocation write an append-only minimal local audit event retained for the lifetime of the local database; create/revoke use the fixed `parent-requested` reason and reset stores no free-text reason. The parent BFF is read-only `GET /api/parent/performance`: it derives the complete active linked-child scope from the parent session and returns capped aggregate Practice/Test/next-Practice facts only; it accepts no child identifier. Since `parent-progress-cards` those facts ship as two projections of one aggregation — the bounded A2UI document (unchanged compilation) and a structured `children` array (`username` plus the same aggregate fields, username-ascending, same 13-child cap, no new evidence kinds) — and the portal page renders per-child progress cards from the structured projection with the account actions inline.
- **Shape:** mixed

## Implementation status

The relationship foundation, local audit trail, aggregate linked-child
Performance view (A2UI), and the non-mutating reviewed Practice preview are
implemented and covered by route/e2e tests. Free-text revocation reasons,
audit export, and retention changes remain Ask-first policy options, and
first-parent recovery remains an approved-bootstrap-only mechanism. Since
`parent-progress-cards` the portal page renders one progress card per child
(username plus the same pluralized aggregate phrases, actions inline) ahead
of the add-account form; the route still issues the unchanged A2UI document
alongside the structured `children` projection.

## Objective

A parent creates and manages password-protected child accounts, links one parent
to one or more children, and opens a Performance portal for only those linked
learners. The parent understands separate Practice/Test evidence and dynamic
A2UI guidance, and can open a non-mutating Practice preview to verify a target
before supporting the child. The portal exposes no answers, keys, private model
data, unsupported diagnosis, or unlinked learner information; the parent can
reset a child password or revoke that child relationship server-side.

## Boundaries

### Always do

- Resolve every viewed learner through a durable server-side parent↔child link,
  not a query parameter, UI gate, or session-provided child ID.
- Require parent role plus canonical-origin proof for relationship mutations;
  make reads no-store and redacted.
- Record relationship lifecycle/revocation and enforce it immediately on every
  portal/API read/action.
- Make parent Practice preview a separate non-mutating session: it never writes
  the child’s attempts, mastery, streaks, badges, test state, or memory.
- Reuse the learner Performance evidence/A2UI catalog with parent-safe wording,
  caps, and action policies.

### Ask first

- External provider verification/authentication, invitations, notifications,
  multiple households, delegated caregivers, export, messaging, or parent
  ability to alter curriculum/test settings. The provider-subject persistence
  seam is not an integration and cannot authenticate or issue a session.
- The first-parent recovery mechanism; initial local setup is the approved
  bootstrap mechanism.
- Changing local audit retention, exporting audit events, or allowing a
  free-text revocation reason.
- Adding Pi-generated parent explanation beyond validated redacted evidence.

### Never do

- Let a parent choose arbitrary learner IDs, view raw answers/questions/keys,
  receive exact child activity timestamps, or access unsupported diagnosis.
- Let parent preview answers be attributed to, displayed as, or otherwise alter
  the child’s learning record.
- Treat admin role as parent role or retain the current prototype parent
  endpoints with ambiguous session-self semantics.
- Let parent guidance mutate learner mastery, answer an assessment, or bypass
  learner assignment tokens.

## Testing Strategy

- **TDD:** relationship lifecycle, authorization resolver, selection policy,
  revocation, and parent-safe projection rules.
- **Integration:** anonymous/learner/admin/unlinked-parent/linked-parent/
  revoked-parent route matrix; cross-child isolation; no-store/redaction;
  origin-protected mutations; A2UI catalog/action allowlist.
- **Visual/manual QA:** linked parent chooses only permitted learner, sees
  empty/sparse/ready Performance states, starts an invitation to Practice, and
  loses access immediately after revocation.

## Acceptance Criteria

- [x] Given no valid parent↔child link, when an account requests the portal or
      any Performance child scope, it receives no child projection.
- [x] Given a linked parent, when the portal loads, it exposes only active linked
      children and a capped/no-store/redacted aggregate Performance view.
- [x] Given relationship revocation, when any existing browser tab retries or
      reloads, the revoked child is omitted without relying on client state.
- [x] Given parent-visible Practice/Test evidence, it remains separate, uses
      child-safe factual wording, and exposes no raw answer/question/key/token or
      exact event-time data.
- [x] Given a parent action, it is limited to a validated support/navigation
      action; it cannot submit, grade, or alter a learner’s work or mastery.
      (The portal's only parent-facing surfaces are relationship management and
      the read-only preview; the preview route is a no-store GET whose
      non-mutation is pinned by `api/parent/preview/route.test.ts`, and it
      exposes no answer, hint, solution, or token material.)
- [x] Given parent relationship creation/revocation, the request requires the
      approved authority, exact origin, validated body, and auditable lifecycle
      transition.

## Assumptions

- Technical: current roles are student/admin and current parent endpoints are
  session-self prototype behavior, not a durable relationship model (source:
  identity and parent route research).
- Technical: Performance/A2UI surfaces remain server-computed and redacted
  (source: related Draft specs).
- Product: v1 supports one local parent account that creates password-protected
  child accounts, manages one or more linked children, can reset/revoke, and
  has a non-mutating Practice preview (source: user confirmation 2026-08-16).
- Product: the first parent sets its own password during local setup; no parent
  identifier or password is committed in source, fixtures, docs, or Git history
  (source: repository privacy policy and user confirmation 2026-08-16).
- Product: first-parent recovery and household/delegation beyond the one-parent
  v1 policy remain unverified and require approval before implementation.
