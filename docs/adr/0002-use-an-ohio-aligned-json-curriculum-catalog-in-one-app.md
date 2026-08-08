# ADR-0002: Use an Ohio-aligned JSON curriculum catalog in one application

- **Status:** Accepted
- **Date:** 2026-08-08
- **Re-evaluate by:** 2026-11-08, or when a curriculum-source update is issued

## Context

The learning experience needs a topic source that the agent and application can
both use consistently. Local operation should remain simple: the browser and
server behavior are exposed by one application process on one port.

## Decision

Maintain a versioned JSON curriculum catalog aligned to the [Ohio Learning
Standards for Mathematics](https://education.ohio.gov/Topics/Learning-in-Ohio/Mathematics/Ohio-s-Learning-Standards-in-Mathematics), using the official
standard identifier, grade or course, topic, and source metadata. The catalog
references standards; it does not silently treat a generated question as proof
of standards alignment.

Use one Next.js application. Its App Router pages render the child portal and
its route handlers and server-side functions provide the application backend;
local development exposes the combined app on one port.

## Consequences

- Topic selection, agent context, and progression can refer to one stable,
  reviewable catalog rather than model memory.
- Catalog updates require source review and versioning; they are not generated
  automatically at runtime.
- No separate API service, proxy, or second local listening port is introduced
  for the first slice.
- The application remains modular internally even though it deploys as one
  unit.

## Alternatives considered

- **Agent-invented topic taxonomy.** Declined because it cannot demonstrate
  durable alignment to the selected standards source.
- **Separate frontend and backend applications.** Declined because it adds
  local deployment, transport, and authentication complexity without serving
  the initial slice.
