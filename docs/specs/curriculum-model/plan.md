# Plan: curriculum model

- **Spec:** [spec.md](spec.md)
- **Status:** Drafting

## Tasks

### T1: Define canonical curriculum records

**Depends on:** none

**Tests:** TDD validation of hierarchy, provenance, and embedding metadata.

**Approach:** Add typed records and SQLite tables in the existing curriculum and app layers. Keep official standards separate from curated teaching topics and assessment targets.

### T2: Add local embedding storage and retrieval

**Depends on:** T1

**Tests:** Integration test loads SQLite-Vec, creates a `vec0` table, embeds through local Ollama, and performs a scoped KNN query.

**Approach:** Pin SQLite-Vec, load it only in server code, and store `nomic-embed-text:latest` 768-dimensional embeddings with content fingerprints.

### T3: Import the Ohio math source

**Depends on:** T1, T2

**Tests:** TDD parser fixtures for Grade 6–8 and high-school sections; manual trace from imported record to PDF page.

**Approach:** Build a reviewable importer that extracts only confidently structured standards and records unresolved text for manual review rather than guessing.
