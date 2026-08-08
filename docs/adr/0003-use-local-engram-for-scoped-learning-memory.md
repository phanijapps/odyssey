# ADR-0003: Use local Engram for scoped learning memory

- **Status:** Accepted
- **Date:** 2026-08-08
- **Re-evaluate by:** before the first non-local deployment or any Engram update

## Context

The child portal needs durable, explainable learning-profile memory and a
knowledge graph without granting the agent unrestricted access to child data.
The supplied local Engram workspace provides a built Node native binding and
SQLite-backed memory, knowledge-graph, ontology, and taxonomy capabilities. It
is bleeding-edge source and is not an npm-published standalone dependency.

## Decision

Use the locally built `@engram/node` artifact through a server-only application
port. Its source location is developer configuration and is not committed. A
startup preflight verifies the generated contracts, native addon, and resolved
source revision; missing or invalid artifacts fail closed.

The application owns a versioned learning-profile ontology and SKOS-style
taxonomy. It seeds and validates them before Engram profile use, maps concepts
to the reviewed curriculum catalog, and requires a reviewed change for any
vocabulary evolution. Engram operations derive scope from the authenticated
child and receive only allowlisted derived learning signals. The agent cannot
call Engram directly or mutate ontology or taxonomy records.

## Consequences

- Learning profile data and graph context gain explicit scope, policy,
  provenance, and vocabulary controls.
- The first slice requires a local native-build preflight and a clear
  unavailable-memory state.
- Application SQLite progress remains authoritative; unavailable profile memory
  cannot change answer submission or progression.
- The source workspace path and other developer-machine values remain outside
  Git-tracked files.

## Alternatives considered

- **Direct package-registry installation.** Declined because the binding is not
  currently published as a standalone package.
- **Agent-authored profile vocabulary.** Declined because ontology and taxonomy
  changes are domain-governance changes that require review.
- **Raw transcripts or answers as profile memory.** Declined because derived
  signals meet the initial adaptation need with less child-data exposure.
