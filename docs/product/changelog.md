# Changelog

All notable user-visible changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

> Historical release entries are retained as an archive. Concrete local account
> identifiers and sign-in values have been redacted; use the current application
> configuration for local access.

## [unreleased-3] — 2026-08-17

### Added

- **Admin parent management** — admins land on the dashboard at sign-in and
  manage parent accounts from a new Parents tab: list every parent with their
  children's usernames, create a parent, reset a password (which signs the
  parent out everywhere). A `devparent` development fixture joins
  `devadmin` / `devstu`.
- **Fixed parent progress visibility** — parent Performance and practice
  preview now aggregate by the learner scope key, so progress actually
  appears for parent-created children (previously always zero).

- **3D knowledge graph** — the dashboard's Knowledge Graph tab links to a new
  full-page interactive 3D force view (drag, rotate, zoom, hover labels) of
  curriculum concepts, prerequisite chains, and learning patterns, with
  kind/predicate coloring. Admin-only; data comes from a capped server
  snapshot.

- **Performance guidance cards** — the learner Performance page now shows one
  card per missed standard after a completed Test, with evidence-stating copy
  and a "Practice this skill" action that opens exactly that reviewed skill's
  existing practice flow. Targets that left the reviewed curriculum (or exceed
  the transport bound) show an honest unavailable card.
- **Parent practice preview** — the parent portal offers a non-mutating preview
  of a linked child's next recommended practice: one reviewed sample question
  with no answer material, fetched on demand and cleared on child
  creation/revocation.
- **Browser journey coverage** — Playwright journeys now cover the
  guidance-action loop, the parent preview, and the full test
  completion/review path against isolated databases (the runner no longer
  touches the shared default curriculum store).

### Changed

- **Learner History panel removed** — Performance now owns the redacted
  activity timeline (with tighter redaction: no scores or timestamps); the
  internal `/api/history` route is retired.

### Fixed

- **Parent portal duplicate heading** — the portal no longer renders both a
  legacy and an A2UI "Child Performance" heading (this had broken two e2e
  journeys).
- **Long standard identities** — topic identities up to 300 characters (real
  ELA standards exceeded the previous 100-char transport bound and made those
  surfaces permanently unavailable).
- **Test progress counter** — the completed-test header no longer reads
  "Question 10 of 9"; terminal and exited-partial screens now show the last
  answered ordinal instead of assuming a next question.
- **Profile memory loads in development** — the bundler's `createRequire` shim
  silently rejected the verified native Engram artifact's dynamic load, so
  profile memory and the knowledge-graph addon stayed "unavailable" under the
  dev server. The loader now takes the real CommonJS require from the platform
  builtin; with the reviewed local artifact configured, the ready state and
  child-scoped signal writes work end-to-end.

## [unreleased-2] — 2026-08-14

### Added

- **Multi-account authentication** — local accounts were stored in SQLite with
  per-account scrypt-hashed password verification. Historical account identifiers
  and sign-in values are redacted.
- **Persistent sessions** — sessions are stored in SQLite and survive server
  restarts; the session cookie now lasts 8 hours, so staying signed in across
  page reloads and dev-server restarts works without re-login.
- **Admin role gating** — the curriculum dashboard requires an admin account;
  Gold record deletion and knowledge-graph seeding are admin-only server-side.
- **Session continuity** — the practice page remembers the last practiced skill
  (localStorage) and resumes it automatically after sign-in or reload.
- **Browser password saving** — sign-in uses the Credential Management API so
  password managers offer to save credentials.
- **Knowledge-graph browser content** — the dashboard Knowledge Graph tab now
  lists recent learning patterns (mastered/struggled edges) and curriculum
  prerequisite chains, plus search.

### Fixed

- **Subject normalization** — Gold records previously held four subject variants
  (`mathematics`, `Mathematics`, `English Language Arts`, `english-language-arts`);
  all normalized in place to exactly two subjects.
- **Topic/question mismatch** — three-layer fix. (1) The generation prompt
  leads with the exact standard ("The question MUST test this exact standard:
  …") and the user message restates the skill. (2) AI generation retries once
  on transient failure. (3) The question-bank fallback now matches by the
  standard's own text — never by its broader domain (8.EE.6 previously served
  a Grade 6 expression-evaluation question because "Expressions and Equations"
  matched the domain), and prefers the bank entry sharing the most words with
  the standard. When no bank topic genuinely covers the skill, the student
  sees a retry state instead of a mismatched question. Verified across three
  consecutive runs on 8.EE.6: similar-triangles slope questions each time,
  including the fallback path.
- **Question card sizing** — question text reduced to 0.95rem; question and
  diagram render in equal-width grid columns.

## [unreleased] — 2026-08-14

### Added

- **AI question generation** — practice questions are now generated by the
  local Ollama model for every skill, including the answer, acceptable
  alternatives, and a hint. Questions are scoped to the Gold standards for the
  selected skill. Falls back to the reviewed question bank when the model is
  unavailable.
- **Adaptive difficulty graph** — questions come in batches of 6. Wrong
  answers drop difficulty, correct answers climb back up. No question repeats
  within a batch.
- **Lazy pool generation** — only the first question is generated up front;
  each next question generates after the child answers. First question loads
  in ~3 seconds (was ~38).
- **IXL-style practice page** — single header with subject + grade dropdowns
  and a search bar with instant typeahead; ✨ semantic search for fuzzy
  queries; collapsible skill browser; full-width practice area.
- **Math formula rendering** — `MathText` component renders exponents,
  fractions, and subscripts as formatted HTML (`x^2` → x², `1/2` → stacked
  fraction).
- **Knowledge graph (Engram)** — Gold standards seed as concept entities with
  prerequisite chains; every answer records a learning-pattern entity and a
  mastered/struggled relationship; mastery beliefs track per-standard accuracy.
  Searchable from the dashboard.
- **Curriculum dashboard** (`/dashboard`) — Mantis-style admin layout with
  Overview, Browse Gold (filterable record browser with delete), Ingest Source
  (Bronze → Silver → Gold pipeline), Parent Portal (stats, accuracy bars,
  queryable chat, activity timeline), and Knowledge Graph search.
- **Grade 6-8 math standards seeded** — 85 official Ohio standards across all
  five domains, replacing incomplete LLM extraction.
- **Search API** — `/api/curriculum/search` with text and semantic modes.

### Changed

- **Ingestion reliability** — replaced the pi-agent-core runner with direct
  Ollama fetch; markdown-fence-stripping JSON parser; chunked Silver
  extraction (15K chars) and batched Gold formalization (20 records);
  persistent SQLite workflow store surviving restarts; resilient per-chunk
  error handling.
- **Practice topic selection** — replaced the static 11-topic dropdown with
  the full Gold curriculum tree (728 standards across Math and ELA).
- **Answer checking** — numeric tolerance, unit stripping, and acceptable
  alternative answers (e.g. "0.5" matches "1/2", "4 girls" matches "4").
- **Progress persistence** — learning data now survives server restarts
  (SQLite on disk instead of `:memory:`).
- **Local access fixture** — the development sign-in fixture changed; its
  identifiers and values are redacted.

### Fixed

- First-question latency (38s → 3s) via lazy pool generation.
- Answer submissions rejecting compound topic IDs (removed stale catalog
  validation from answer, memory-signal, and generated-question paths).
- Turbopack's inability to load the Engram native addon (eval-require).
- Question-bank fallback for curriculum-selected topics (keyword matching).

## [0.1.0] — 2026-07-31

### Added

- Initial Next.js application with sign-in, topic selection, single-question
  practice, SVG diagrams, and SQLite persistence.
- Curriculum package with catalog parsing and promotion workflow contracts.
- Bronze → Silver → Gold curriculum ingestion pipeline.
