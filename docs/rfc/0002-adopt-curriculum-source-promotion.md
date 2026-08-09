# RFC-0002: Adopt curriculum source promotion

- **Status:** Accepted
- **Date:** 2026-08-09

## Decision

Curriculum ingestion is source- and subject-neutral. Every submitted document
or feed moves through Bronze, Silver, and Gold states. Distinct bounded Pi
agents perform Bronze-to-Silver extraction and approved Silver-to-Gold
formalization; application code remains the authority for validation, approval,
persistence, embeddings, and retrieval.

## Consequences

- PDF, CSV, JSON, API, and unstructured sources share one canonical pipeline.
- Silver output is reviewable candidate data, never authoritative curriculum.
- Gold records are the only records available to learning, assessment, and
  retrieval. A source-specific parser is an adapter, not a core dependency.
