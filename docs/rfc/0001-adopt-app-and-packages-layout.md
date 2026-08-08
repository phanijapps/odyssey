# RFC-0001: Adopt an app and reusable-packages layout

- **Status:** Accepted
- **Date:** 2026-08-08

## Summary

Organize the repository around one deployable Next.js application in `app/` and
reusable, application-independent packages in `packages/`.

## Decision

- `app/` contains the single Next.js application, including its App Router
  frontend, server-side routes and actions, and local runtime configuration.
- `packages/` contains only focused reusable code with at least two consumers,
  such as curriculum contracts shared by the learning service and agent
  adapter. It does not become a dumping ground for application-specific code.
- The application remains a single local process exposed on one port. Packages
  are linked at build time and do not become independently deployed services.

## Consequences

- UI and backend concerns can evolve in one application without a second API
  deployment.
- Shared contracts and deterministic learning logic gain clear reuse boundaries.
- New reusable packages need a named second consumer; speculative abstractions
  remain in the application until that need exists.

## Alternatives considered

- **A root-level Next.js application.** Declined because the requested layout
  needs a clear deployable-app boundary.
- **Separate frontend and backend applications.** Declined by ADR-0002 because
  it introduces unneeded local transport and deployment complexity.
- **A single catch-all shared package.** Declined because it would become a god
  module and obscure ownership.
