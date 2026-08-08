# Spec: child math practice

- **Status:** Implementing
- **Owner:** Example User
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** ADR-0001, ADR-0002, ADR-0003, RFC-0001
- **Brief:** none
- **Discovery:** none
- **Contract:** none
- **Shape:** mixed

> **Spec contract:** this document defines what "done" means. The implementing
> PR must match this spec, or update it. Verification must be derivable from it.

## Objective

The child portal lets a signed-in child in grades 6–12 choose a reviewed math
topic, answer one question at a time, and receive an appropriate next question
and optional labeled diagram. A local Engram memory boundary keeps a scoped,
purpose-limited learning profile and knowledge graph from reviewed signals. It
uses a quiet, focused interface inspired by
the referenced control-center hierarchy while keeping the problem and its
diagram as the primary task. The agent adapts difficulty only through bounded,
auditable learning actions; the application remains the authority for identity,
progress, and curriculum alignment.

## Boundaries

### Always do

- Run the browser UI, server behavior, SQLite persistence, and local development
  through one Next.js application exposed on one port.
- Load topics from a versioned JSON catalog with Ohio Learning Standards source
  metadata; ship a small reviewed seed catalog for the first slice.
- Validate child input, generated question payloads, A2UI payloads, and SVG
  diagrams before using them; record progression decisions with their source.
- Keep the agent's active tools limited to requesting a question, an optional
  diagram, and a bounded difficulty recommendation.
- Build and validate a reviewed learning-profile ontology and taxonomy before
  storing or retrieving Engram-backed profile data.

### Ask first

- Add a model provider, provider credential, external MCP server, or new agent
  tool.
- Add a parent account, parent conversation capability, subject beyond math, or
  production deployment.
- Expand the reviewed curriculum seed or change the standards source.
- Change the profile ontology, taxonomy, retention, or memory signal allowlist.

### Never do

- Let the agent create or modify the curriculum catalog, invoke arbitrary tools,
  decide authorization, write arbitrary database records, or evolve ontology or
  taxonomy definitions at runtime.
- Render executable agent output, unvalidated SVG, or arbitrary A2UI components
  in the browser.
- Introduce a separate frontend/backend deployment, a second listening port, a
  speculative shared package, or a god module.

## Testing Strategy

Curriculum parsing, answer evaluation, difficulty bounds, password hashing, and
SVG/A2UI validation use TDD because their invariants are deterministic. App
scaffolding and one-port startup use goal-based checks. The child sign-in,
topic-selection, answer, diagram, and provider-unavailable paths use visual and
manual QA against the running application because they are user-visible flows.
Engram scope, vocabulary validation, profile-signal projection, and unavailable
native-binding behavior use TDD and local integration checks.

## Acceptance Criteria

- [ ] Given the local app is started, when a browser opens it, the child portal
      and its server behavior are available from one application on one port.
- [ ] Given the seeded child account, when valid credentials are submitted, the
      child reaches the topic-selection view; invalid credentials do not reveal
      whether an account exists. Passwords use a per-password salted scrypt,
      sessions use CSPRNG tokens stored as hashes, login rotates the session, and
      no more than five failed attempts per account in 15 minutes are accepted.
      Logout invalidates the session; 30 minutes of inactivity and eight hours
      after login expire it; the seed credential is unavailable outside local
      development.
- [ ] Given the reviewed seed catalog, when a child chooses a topic, the app
      presents a question whose standard identifier, grade or course, and topic are
      traceable to the catalog source metadata.
- [ ] Given a submitted answer, when the agent recommends a next difficulty,
      the learning service persists the recommendation and accepts only the current
      level or one adjacent level. The next rendered question is new, uses the
      accepted recommendation, remains within the selected catalog topic, and
      records its level and standards metadata.
- [ ] Every learning read or mutation derives the child identity from the
      server-owned session before the side effect, scopes SQLite records to that
      identity, and accepts only an allowlisted answer-submission shape.
- [ ] Every mutating server action requires an `HttpOnly`, `SameSite=Strict`
      session cookie and validates the same-site Origin or a server-issued CSRF
      token before reading or changing learning state.
- [ ] Given an approved diagram request, when a labeled SVG payload satisfies
      the allowlist, the question view renders it; unsafe elements, attributes, or
      URL-bearing values are rejected and never rendered.
- [ ] A reviewed local fixture supplies an approved question and labeled SVG
      diagram for the local happy path without a model-provider credential.
- [ ] Child input, catalog JSON, agent and tool events, A2UI payloads, and SVG
      payloads use typed schemas that reject unknown fields. SQLite access uses
      parameterized statements; unsafe deserialization, raw HTML, and executable
      model output never reach persistence or rendering.
- [ ] The app renders only application-owned A2UI catalog components and runs
      only the three registered learning actions; unknown component or tool payloads
      fail closed before they change state or reach the browser.
- [ ] Given a missing model-provider configuration, when a generated-content
      action is requested, the child sees a clear unavailable state and no provider
      credential, internal error, or arbitrary model output is exposed.
- [ ] Model calls receive only the authenticated child's authorized learning
      context; child, catalog, Engram memory, model, and tool data remain data
      rather than instructions. Retrieved memory is bounded, typed, provenance- and
      vocabulary-version checked, and delimited as untrusted data; invalid memory
      is ignored. Each answer event permits one generated-content request, with a
      15-second timeout, at most one retry, a 2,048-token ceiling, and a USD 0.02
      per-request / USD 0.20 per-session cost ceiling; output is validated before
      every sink.
- [ ] Given a valid local Engram native artifact, when the application records
      or retrieves learning-profile memory, it uses a server-only adapter and a
      scope derived from the authenticated child. Startup canonicalizes the
      developer-configured source and addon under an approved local root, rejects
      symlink escape, dirty or untracked source, and verifies the source revision,
      generated-contract digest, and native-addon digest against the reviewed local
      setup record before loading. Only exact-schema derived signals (catalog topic,
      accepted bounded level, correctness, and enumerated progress state) cross the
      boundary; unknown fields and passwords, session tokens, raw answers, prompts,
      and provider credentials are rejected. If the artifact is unavailable or
      invalid, the child receives a clear recoverable state and local learning
      progress remains correct.
- [ ] Before profile memory is used, the application seeds and validates a
      versioned, reviewed learning-profile ontology and SKOS-style taxonomy. The
      ontology defines the minimal profile concepts and relationships; the taxonomy
      maps math subject, grade or course, standard, topic, difficulty, and mastery
      concepts to the reviewed curriculum catalog. Seed writes are idempotent,
      scope and policy are enforced on every memory read or write, and neither the
      agent nor child input can alter the vocabulary at runtime.
- [ ] The Pi dependency is locked with integrity metadata and the configured
      dependency audit passes before the implementation is accepted.
- [ ] Logs and client errors exclude passwords, session tokens, provider
      credentials, raw child answers, and raw prompts; persisted audit records keep
      only purpose-bound learning and validation fields.
- [ ] The above-fold child experience shows the selected topic, one question,
      answer controls, an optional diagram panel, and a numeric or named progress
      indicator; it contains no control-center branding or copied UI code.

## Assumptions

- Technical: Node 24.19.0 supports Pi Mono core 0.84.1's runtime requirement
  (source: local runtime probe and `npm view` on 2026-08-08).
- Technical: local SQLite uses Node's built-in `node:sqlite` API (source:
  https://nodejs.org/api/sqlite.html).
- Product: first content is a small reviewed seed of a versioned grades 6–12
  Ohio-aligned catalog (source: user confirmation 2026-08-08).
- Product: a seeded local child account is the initial identity flow and the
  agent may recommend only an adjacent difficulty level (source: user
  confirmation 2026-08-08).
- Process: the app is in `app/`, reusable code is in focused `packages/`, and
  one Next.js process exposes the local experience (source: RFC-0001 and user
  confirmation 2026-08-08).
- Technical: no model provider is configured; a deterministic Pi-compatible
  local fixture exercises agent boundaries and the approved-diagram happy path
  until one is selected (source: user confirmation 2026-08-08).
- Technical: a locally built `@engram/node` artifact supplies the initial
  Engram integration. Its source location is developer configuration rather
  than committed repository data; the server preflight records the verified
  revision and rejects a missing addon (source: user confirmation 2026-08-08
  and local contract inspection).
