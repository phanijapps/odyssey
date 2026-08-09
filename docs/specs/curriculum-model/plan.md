# Plan: curriculum model

- **Spec:** [spec.md](spec.md)
- **Status:** Drafting

## Tasks

### T1: Define Bronze, Silver, and Gold curriculum records

**Depends on:** none

**Tests:** TDD validation of hierarchy, provenance, and embedding metadata.

**Approach:** Add typed source, candidate, approval, and Gold-record contracts in
the existing curriculum and app layers. Keep official standards separate from
curated teaching topics and assessment targets.

### T2: Add local embedding storage and retrieval

**Depends on:** T1

**Tests:** Integration test loads SQLite-Vec, creates a `vec0` table, embeds through local Ollama, and performs a scoped KNN query.

**Approach:** Pin SQLite-Vec, load it only in server code, and store `nomic-embed-text:latest` 768-dimensional embeddings with content fingerprints.

### T3: Add source-neutral agent promotion

**Depends on:** T1, T2

**Tests:** TDD transition tests prove only an approved Silver candidate becomes
Gold; adapter fixtures cover PDF, CSV, JSON, and unstructured source inputs.

**Approach:** Build a Bronze → Silver extraction port and an approved Silver →
Gold formalization port, each owned by a distinct bounded Pi agent. Keep Ohio
math as one source adapter, not a pipeline assumption.
