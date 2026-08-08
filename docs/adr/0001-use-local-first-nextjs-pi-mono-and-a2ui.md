# ADR-0001: Use a local-first Next.js, Pi Mono, and A2UI foundation

- **Status:** Accepted
- **Date:** 2026-08-08
- **Re-evaluate by:** 2026-11-08, or before a production deployment

## Context

The product begins as a child-facing math learning portal for grades 6–12 on a
local laptop. It needs password-based sign-in, durable local progress, topic
driven questions, labeled diagrams, and an agent that is useful without having
unbounded authority over child data or the interface.

## Decision

Use a TypeScript Next.js application running on Node.js 24.19.0 or later.
Persist local application data in SQLite. Integrate Pi Mono through
`@earendil-works/pi-agent-core` 0.84.1 and its Pi AI dependency.

The agent communicates through a server-side boundary and receives only a
small, registered set of learning tools. A2UI renders only a versioned,
validated catalog of application-owned components; the agent does not generate
executable interface code. Generated questions, answer keys, and SVG diagrams
are validated by application code before they are stored or rendered.

Repo-owned skills organize prompt and tool configuration. MCP integrations are
opt-in, capability-scoped, and unavailable to the child-facing agent unless a
future spec explicitly authorizes them.

## Consequences

- Local development has a real persistence and authentication path without
  requiring a hosted service.
- Pi Mono's Node runtime requirement is an explicit environment constraint.
- The application must provide schemas, catalog validation, and audit-friendly
  agent-tool boundaries rather than trusting model output.
- Production hosting, a model provider, parent workflows, and the
  engram-integration adapter remain separate decisions.

## Alternatives considered

- **LangChain TS.** Declined because Pi Mono was selected for the agent runtime
  and its skill, extension, and MCP ecosystem.
- **Hosted PostgreSQL from the start.** Deferred because local SQLite meets the
  first-slice persistence needs with less operational setup.
- **Arbitrary HTML, JavaScript, or SVG from the agent.** Declined because a
  constrained A2UI catalog and validated SVG provide a narrower safety boundary.
