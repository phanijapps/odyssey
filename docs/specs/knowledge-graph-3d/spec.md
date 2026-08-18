# Spec: Knowledge Graph 3D View

- **Status:** Shipped
- **Owner:** Product and Engineering
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** RFC-0003 (persona boundaries)
- **Brief:** maintainer feature request, 2026-08-17
- **Contract:** admin-only `GET /api/knowledge/graph` returns a capped,
  no-store `{ nodes, links }` snapshot of curriculum and learning entities with
  kind-tagged nodes and predicate-tagged links; it accepts no identifiers.
- **Shape:** mixed

## Objective

A dedicated dashboard page renders the knowledge graph as an interactive 3D
force-directed visualization (drag, rotate, zoom, hover labels) so an admin can
see curriculum concepts, prerequisite chains, and learning patterns as one
spatial structure.

## Boundaries

### Always do

- Serve graph data from a server-derived snapshot with bounded node/link caps.
- Tag nodes (curriculum vs learning) and links (predicate) server-side so the
  renderer never infers semantics.
- Fail closed to an honest empty state when the native engine is unavailable.

### Ask first

- Any non-admin visibility, child selection, or graph editing from this view.
- Additional visualization dependencies beyond the one recorded renderer.

### Never do

- Expose child identifiers, account data, or unbounded entity dumps.
- Let the view mutate graph or learner state.

## Testing Strategy

- **TDD:** snapshot caps, kind/predicate tagging, dedup, and the
  engine-unavailable empty case.
- **Integration:** route auth (admin-only), no-store, response shape.
- **Visual/manual QA:** the real page renders nodes and links from the seeded
  graph; screenshot recorded.

## Acceptance Criteria

- [x] Given an admin session, `GET /api/knowledge/graph` returns capped,
      kind-tagged nodes and predicate-tagged links with `no-store`.
- [x] Given a non-admin or anonymous request, the route denies access.
- [x] Given an unavailable engine, the route returns an honest empty snapshot.
- [x] The dashboard links to a distinct page that renders the graph as an
      interactive 3D force visualization from that data alone.
- [x] No child identifier or account data appears in the payload.
