# Plan: Parent Performance Portal

- **Spec:** [`spec.md`](spec.md)
- **Status:** Done

## Approach

Build parent authorization before parent UI. Replace ambiguous prototype parent
semantics with one local parent account created through first-run setup and a
durable relationship lifecycle. The parent selects its own password; credentials
never appear in committed fixtures or documentation.
Expose a single parent-scoped Performance projection through the same A2UI
catalog after its learner-safe evidence is transformed into a parent-safe
projection. Keep all relationship mutations small, origin-protected, audited,
and reversible.

## Constraints

- This plan cannot start before the parent verification/linking policy is
  approved and Performance/A2UI contracts are frozen.
- No client-supplied learner scope; no admin-as-parent fallback.
- No answer/content/diagnostic export, communication, or curriculum control.

## Construction tests

**Integration tests:** full role/link/revocation/access matrix; stale tab after
revocation; request-body/origin validation; projection redaction; parent action
limits; catalog rejection. **Manual verification:** linked/unlinked/revoked
parent portal states and keyboard navigation.

## Design (LLD)

### Data & schema

Use stable account IDs and a `parent_child_links` lifecycle with creator,
created/revoked times, relationship status, and revocation reason code. Do not
store parent access snapshots in learner records. Define retention/audit policy
before migration.

### Interfaces & contracts

Use separate parent relationship administration and parent Performance read
contracts. The read takes no arbitrary child ID; optional learner selection is
a server-validated opaque linked-child selector. Parent actions carry no learner
answer or assignment token.

### Component / module decomposition

- identity relationship repository/resolver;
- parent Performance projection adapter over shared evidence;
- parent A2UI page and fixed catalog components;
- relationship management UI only for the approved authority.

### Failure, edge cases & resilience

Unknown/revoked/expired link, stale selection, concurrent revoke/read, no data,
sparse data, unavailable target, and renderer mismatch all fail closed with
non-sensitive states. Existing prototype parent endpoints are migrated or
retired only after contract parity and security review.

## Tasks

### T1: Approve parent identity, link, revocation, and audit policy

**Status:** Complete — the approved policy is the spec's Contract section:
local-only relationship administration, session-derived parent scope,
origin-protected mutations, fixed machine reasons, append-only lifetime audit
events, and configuration-gated first-parent bootstrap with no public
provisioning or recovery.

**Depends on:** none

**Tests:** policy fixtures for roles, one/many link rules, authority, revocation,
recovery, and retention.

**Approach:** produce the dedicated auth design review; implementation does not
start until it is approved.

### T2: Implement tested relationship authority and lifecycle

**Depends on:** T1

**Status:** Complete for the approved v1 policy. Schema v8 provides immutable account/session
principals, active/revoked parent-child links, and provider-subject links. The
parent-only child list/create/reset/revoke routes and local account-management
page derive authority from the parent session and retest links transactionally.
The first parent can be provisioned in production only by explicit server-side
configuration while no parent account exists; there is no public provisioning
or recovery route. Lifecycle changes write minimal local append-only events
retained for the database lifetime; only fixed machine reasons are recorded, so
free-text reasons, export, and retention changes still require approval.

**Tests:** TDD lifecycle/resolver/transaction/revocation cases plus route matrix.

**Approach:** add durable link schema and server guard; preserve existing
learner/admin boundaries.

### T3: Replace prototype parent reads with parent-scoped Performance BFF

**Depends on:** T2, `spec:performance-guidance/T3`

**Status:** Complete for the aggregate v1 view. `GET /api/parent/performance`
derives all active children from the parent session, returns no-store aggregate
Practice/Test/next-Practice facts, and omits IDs, answers, questions, keys,
tokens, scores, timestamps, and target standards.

**Tests:** parent-safe projection/no-store/redaction/cross-child/stale-tab tests.

**Approach:** adapt shared evidence only after server link resolution.

### T4: Render parent A2UI Performance portal

**Status:** Complete. The parent-specific A2UI document renders the aggregate
linked-child Performance (the portal's duplicate legacy heading was removed so
the document owns the section), and the non-mutating Practice preview delivers
one reviewed sample of the first linked child's next recommended target with
no answer material and no writes (covered by route tests and the
parent-lifecycle browser journey).

**Depends on:** T3, `spec:a2ui-learning-delivery/T5`

**Tests:** catalog/action/render state tests and manual keyboard/mobile QA.

**Approach:** reuse fixed catalog components, with parent-specific wording and
no learner-work mutation actions.

### T5: Retire or harden ambiguous prototype parent endpoints

**Depends on:** T3, T4

**Status:** Complete. The ambiguous legacy summary and chat endpoints fail
closed with no-store `410` responses, the admin dashboard no longer invokes
them, and their replacement — the linked-child Performance BFF — is shipped.
With no compatibility consumers and the successor live, the `410` is the
published deprecation decision for the local-only surface.

**Tests:** API compatibility/security review and deprecated-route behavior tests.

**Approach:** publish migration/deprecation decision before deleting a public
route.

## Risks

- Parent linkage is a child-data security boundary; use full secure-design
  review and deny by default.
- “Support” can drift into control; catalog actions remain navigation-only.
- Existing prototype endpoints can mislead consumers; keep them out of new UI
  and resolve their public contract explicitly.

## Changelog

- 2026-08-16: Drafted after parent portal requirement confirmation.
- 2026-08-16: Began relationship foundation; ambiguous prototype routes fail closed pending the protected Performance BFF.
- 2026-08-17: Added the aggregate parent-scoped Performance BFF and portal view; preview remains deferred.
- 2026-08-17: Closed as Done — delivered the non-mutating reviewed Practice
  preview (route, redaction, and no-mutation tests plus a browser journey),
  removed the duplicate portal heading, and confirmed the deprecated prototype
  endpoints' fail-closed posture.
