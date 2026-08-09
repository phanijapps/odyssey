# Spec: curriculum model

- **Status:** Draft
- **Plan:** [plan.md](plan.md)
- **Shape:** data

## Objective

The application stores source-backed curriculum content in a reusable subject
model. Any submitted source moves through Bronze raw source, Silver reviewable
normalization, and approved Gold formal curriculum. Gold records retain their
original identifiers, text, source location, grade or course, domain, cluster,
and curated teaching topics. Each searchable Gold record has a locally
generated embedding for curriculum retrieval.

## Boundaries

### Always do

- Preserve the source document, page number, official code, and exact standards text.
- Model `Subject → Framework → Grade/Course → Domain → Cluster → Standard → Topic → AssessmentTarget` without making topics a replacement for official standards.
- Store vectors in SQLite-Vec and generate them locally through Ollama using `nomic-embed-text:latest`.

### Ask first

- Add a second standards framework, another subject, or a cloud embedding provider.
- Change an imported official-standard record after it is stored.

### Never do

- Let an agent create, alter, or delete official standards.
- Put raw PDF pages or a vector database behind a browser endpoint.
- Add a new top-level package or runtime service.

## Testing Strategy

- TDD verifies canonical record validation, source provenance, hierarchy links, and fixed embedding metadata.
- Integration verifies SQLite-Vec loads, a 768-dimensional local Ollama embedding persists, and a nearest-neighbor lookup returns the source record.
- Manual QA verifies an imported Grade 6–12 record can be traced from topic through the original PDF page.

## Acceptance Criteria

- [ ] A subject-neutral canonical record represents frameworks, grade/course bands, domains, clusters, standards, curated topics, and assessment targets.
- [ ] Each official standard retains an identifier, exact source text, source document fingerprint, and page number.
- [ ] Any source adapter creates Silver candidates without treating extraction as
      authoritative curriculum; only approved candidates become Gold records.
- [ ] Each embedding record stores its model name, dimension, source-record identifier, and content fingerprint; `nomic-embed-text:latest` vectors have dimension 768.
- [ ] SQLite-Vec stores vectors locally and supports a bounded nearest-neighbor lookup scoped to a subject and framework.
- [ ] The application exposes no browser route for raw curriculum documents, embeddings, or unrestricted vector search.

## Assumptions

- The supplied 99-page PDF is Ohio’s Learning Standards Mathematics 2017 (local PDF probe).
- Node’s installed SQLite API supports extension loading (local `node:sqlite` probe).
- Local Ollama exposes `nomic-embed-text:latest`; its `/api/embed` response has 768 dimensions (local Ollama probe).
- SQLite-Vec’s `vec0` tables accept float vectors and KNN queries; its pre-1.0 contract is pinned and tested before import code is written ([sqlite-vec documentation](https://github.com/asg017/sqlite-vec)).
