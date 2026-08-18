# Spec: Parent Management

- **Status:** Shipped
- **Owner:** Product and Engineering
- **Plan:** [`plan.md`](plan.md)
- **Related:** [parent-performance-portal](../parent-performance-portal/spec.md)
- **Brief:** maintainer request, 2026-08-18 — admins manage parents; each
  parent manages their children; parents view read-only progress; admins
  upload curriculum.
- **Contract:** `GET /api/admin/parents` (admin session) returns a no-store
  `{ parents }` list with each parent's children usernames;
  `POST /api/admin/parents` (admin mutation proof, exact `{username,
password}` body) creates a parent → `201`;
  `PATCH /api/admin/parents/{accountId}` (exact `{password}` body) rotates
  the password and invalidates that parent's sessions → `204`. Sign-in
  routes admin → `/dashboard`, parent → `/parent`. Parent performance and
  preview aggregate by the learner scope key.
- **Shape:** feature

## Summary

Admins manage parent accounts: list every parent with their children,
create a parent, and reset a parent's password. Each parent continues to
manage their own children from the existing `/parent` portal, and parents
keep their read-only performance and preview views. Admins also land on
the admin dashboard at sign-in, and a development-only `devparent`
fixture mirrors the existing `devadmin` / `devstu` fixtures.

## Contract detail

`GET /api/admin/parents` (admin session) returns
`{ parents: [{ accountId, username, children: [{ username }] }] }`,
`no-store`. `POST /api/admin/parents` (admin mutation proof, exact
`{username, password}` body) creates a parent and returns
`201 { parent: { accountId, username } }`.
`PATCH /api/admin/parents/{accountId}` (admin mutation proof, exact
`{password}` body) rotates the parent's password and invalidates all of
that parent's sessions in the same transaction → `204`.

Sign-in routes by role: admin → `/dashboard`, parent → `/parent`,
student → the learner portal.

Parent-facing performance and preview aggregate by the learner scope
key (`child:<username>` for non-fixture students), the same key under
which learner data is written.

## Boundaries

- Admin powers over parents are exactly: list, create, reset password.
  No delete, no deactivation, no admin-side link revocation, no admin
  visibility into children's learning detail beyond usernames.
- Admin parent-account actions are not written to
  `parent_relationship_events`: that ledger requires a child leg
  (`child_account_id NOT NULL`, fixed event-type CHECK) and admin
  actions have none. Revisit only when a log reader exists.
- The parent portal surface is unchanged apart from the scope-key fix.
- No new dependencies.

## Acceptance criteria

- [x] An admin session lists parents with each parent's active children
      usernames; a parent session, student session, and anonymous request
      each fail closed (401/403) with `no-store`.
- [x] An admin creates a parent (exact-shape body; malformed body → 400);
      duplicate username → 400 "username unavailable"; the created parent
      can sign in and lands on `/parent`.
- [x] An admin resets a parent's password; every prior session of that
      parent fails immediately, the old password is rejected, the new one
      works. Reset against a non-parent accountId → 403.
- [x] Admin mutations require the same-origin proof; cross-origin → 403.
- [x] Admin sign-in (fresh or restored session) routes to `/dashboard`;
      parents route to `/parent`; students are unchanged.
- [x] A parent-created child who answers practice appears in the parent's
      Performance with nonzero aggregates and a resolvable preview, under
      the learner scope key; redaction guarantees are unchanged (no
      accountId / childId / topicId / answer material in the payload).
- [x] Production seeding is unchanged: no fixture accounts without the
      development flag, and an env-configured local bootstrap still seeds
      when fixtures are enabled (bootstrap wins over the zero-parents
      guard).

## Testing strategy

- Route tests for `/api/admin/parents` mirroring the parent-children
  route tests (guards, body shape, no-store, session invalidation).
- Regression rewrite of the parent performance/preview tests that
  previously seeded `accountId === username` and masked the scope-key
  defect; the rewritten seeding is the regression test.
- Identity unit tests: scope-key helper, parent lifecycle (UNIQUE
  collision, role enforcement on reset), fixture/bootstrap seed order.
- Manual QA script in `notes/manual-qa.md` terms: the admin → parent →
  child → practice → nonzero performance journey.
