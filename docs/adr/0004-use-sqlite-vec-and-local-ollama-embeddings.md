# ADR-0004: Use SQLite-Vec and local Ollama embeddings for curriculum retrieval

- **Status:** Accepted
- **Date:** 2026-08-09
- **Re-evaluate by:** before a non-local deployment or a SQLite-Vec major release

## Context

Curriculum records need local semantic retrieval without sending standards or
child-learning context to a remote vector service. The app already runs local
SQLite and Ollama.

## Decision

Use the server-only `sqlite-vec` extension for local vector storage and nearest
neighbor queries. Generate embeddings through the local Ollama `/api/embed`
endpoint with `nomic-embed-text:latest`; persist the model name, vector
dimension, and content fingerprint with each vector.

## Consequences

- Curriculum retrieval stays on the laptop and shares the existing SQLite data
  boundary.
- SQLite-Vec is pre-1.0, so its exact package version is pinned and its loading
  and query contract is integration-tested.
- A missing extension or local embedding model makes retrieval unavailable; it
  does not alter source curriculum records.

## Alternatives considered

- **Remote vector service.** Declined because local-first curriculum retrieval
  does not require sending source or learning context off-device.
- **Embedding blobs without vector search.** Declined because it prevents
  bounded curriculum retrieval.
