# Plan: Knowledge Graph 3D View

- **Status:** Done

## Approach

Add one admin-scoped snapshot projection over the existing knowledge engines,
then a dedicated dashboard page that renders it with the 3d-force-graph
renderer (d3-force-3d layout in WebGL). The renderer is a client-only
presentation layer; all semantics (kinds, predicates, caps) come from the
server snapshot.

## Constraints

- One new client dependency, recorded in the package AGENTS.md before use.
- No server state changes; the view is read-only.

## Tasks

### T1: Graph snapshot projection and route

**Status:** Complete — snapshot seam unit-tested (kinds, predicates, caps, empty case); route admin-only/no-store pinned by its test.
**Tests:** TDD caps/kinds/predicates/unavailable; route auth + no-store.
**Approach:** `graphSnapshot()` in knowledge-graph.ts; `GET /api/knowledge/graph`.

### T2: 3D page and dashboard link

**Status:** Complete — rendered the live 728-entity graph (800-node capped snapshot, 700 links) in a headless browser; screenshot recorded in the session QA trail.
**Tests:** visual/manual — real render of the seeded graph, screenshot recorded.
**Approach:** dynamic client import of 3d-force-graph under `/dashboard/graph`;
link from the Knowledge Graph tab.

### T3: Dependency record and closure

**Status:** Complete — `3d-force-graph@1.80.0` recorded in app/AGENTS.md.
**Approach:** record `3d-force-graph` in app/AGENTS.md; close statuses.

## Changelog

- 2026-08-17: Drafted from the maintainer feature request.
- 2026-08-17: Shipped — snapshot route, 3D page, dashboard link, dependency record.
