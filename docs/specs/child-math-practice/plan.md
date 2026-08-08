# Plan: child math practice

- **Spec:** [`spec.md`](spec.md)
- **Status:** Drafting

## Approach

Create a pnpm workspace with one Next.js app under `app/` and one shared
curriculum package under `packages/`. The app owns its SQLite database,
credentials, server-side Pi Mono adapter, validation, and child UI. The package
holds catalog contracts and deterministic progression rules used by both the
learning service and agent adapter. Use Node's `node:sqlite` API and built-in
password primitives to avoid extra local persistence or authentication
dependencies. The riskiest work is proving that untrusted agent payloads remain
bounded before the UI renders them.

## Constraints

- Conforms to ADR-0001, ADR-0002, RFC-0001, and the feature boundaries in
  [`spec.md`](spec.md).

## Construction tests

**Integration tests:** local SQLite migration plus seeded-login and answer
submission flow; agent adapter validation with deterministic streamed fixtures.

**Manual verification:** record the local child-flow result in
`docs/specs/child-math-practice/notes/manual-qa.md`: seeded sign-in, topic
selection, answer submission, next question, approved fixture diagram, and the
provider-unavailable state. This session covers only the local seeded-child
journey; production provider behavior and server-only security controls are
verified by automated tests, not manual QA.

## Design (LLD)

### Design decisions

The application uses the Next.js App Router for pages and server actions. It
uses a local `node:sqlite` repository behind focused identity and learning
services. `@earendil-works/pi-agent-core` is wrapped in a server-only adapter;
a deterministic fixture supplies structured events until a provider is chosen.
Traces to: all ACs · no external contract.

### Data & schema

The curriculum package defines the versioned JSON catalog and schema for a
standard identifier, grade or course, topic, source URL, and revision metadata.
The app owns SQLite tables for child accounts, sessions, attempts, current
level, and progression decisions. Password records contain a salted derived key
and parameters, never a plaintext password. Traces to: AC 2–4.

### Component / module decomposition

`app/` owns routes, server actions, repositories, and UI. The topic selector,
question card, diagram panel, answer controls, and progress indicator are
separate components. `packages/curriculum` owns catalog parsing and progression
rules shared by the learning service and agent adapter. Each validation concern
has its own focused module. Traces to: AC 1–7.

### State & control flow

Sign-in creates a server-owned session. Topic selection loads a reviewed
catalog record. Answer submission evaluates the attempt, asks the agent adapter
for a bounded next-level recommendation, validates it, persists it in a
transaction, then renders the next question state. A missing provider renders a
recoverable unavailable state. Traces to: AC 2–6.

### Behavior & rules

The learning service accepts only a current level or adjacent-level agent
recommendation. Generated SVG permits only a fixed set of shapes, text labels,
and non-URL attributes. A2UI uses an application-owned catalog of components;
unknown component names or fields fail closed. Traces to: AC 3–6.

### Failure, edge cases & resilience

Invalid credentials, malformed catalog data, unsafe agent payloads, unavailable
providers, and SQLite errors produce non-sensitive child-facing states and
structured server logs. A failed validation never changes learning progress.
Traces to: AC 2, 4–6.

### Quality attributes (NFRs)

The interface uses the reference control center only for restrained visual
hierarchy and token discipline. It keeps one primary task above the fold,
supports keyboard answer submission, and exposes clear focus indicators.
Traces to: AC 7.

### Dependencies & integration

Pi Mono core is a server-only dependency. Node's built-in SQLite module avoids
a database driver. A model provider and external MCP integrations are deliberately
unconfigured. Traces to: AC 4–6.

## Tasks

### T1: Establish the one-app workspace and local runtime

**Depends on:** none

**Touches:** package.json, pnpm-lock.yaml, pnpm-workspace.yaml, app/**,
packages/curriculum/**, AGENTS.md, docs/architecture/overview.md

**Tests:**
- Goal-based: the workspace installs, typechecks, and starts the Next.js app on
  one configured port (AC 1).
- Goal-based: application and package imports resolve without creating a second
  runtime or deployable package (AC 1).
- Goal-based: the dependency-audit command documented in `AGENTS.md` passes and
  `pnpm-lock.yaml` records the intended Pi dependency with integrity metadata
  (AC 13).

**Approach:**
- Add the root workspace manifest, the Next.js application in `app/`, and the
  focused curriculum package with only its public entry point.
- Set Node and package-manager constraints and document the actual install,
  lint, typecheck, test, and start commands in `AGENTS.md`.
- Add test tooling and activate the pre-written red TDD stubs named in T2–T4.

**Done when:** the app starts locally through one command, workspace typecheck
and the dependency-audit command documented in `AGENTS.md` pass, and the
architecture overview maps `app/` and `packages/curriculum/`.

### T2: Make the curriculum catalog and bounded progression deterministic

**Depends on:** T1

**Touches:** packages/curriculum/**

**Tests:**
- TDD: malformed catalog records and unknown source metadata are rejected
  (AC 3, 9).
- TDD: a next-level recommendation outside the current level or adjacent level
  is rejected (AC 4).

**Stub:** `packages/curriculum/src/catalog.test.ts` and
`packages/curriculum/src/progression.test.ts` are pre-written red stubs.
**stub:** true

**Approach:**
- Define typed catalog and progression contracts plus a small reviewed Ohio
  seed catalog.
- Export pure parsing and progression validation functions for the app and
  agent adapter.

**Done when:** catalog and progression tests pass without a running app.

### T3: Add SQLite identity and learning-progress services

**Depends on:** T1, T2

**Touches:** app/src/server/identity/**, app/src/server/learning/**,
app/src/server/sqlite/**

**Tests:**
- TDD: password verification accepts only the correct seeded credential and
  produces a generic rejection otherwise (AC 2).
- TDD: an accepted answer and validated next-level recommendation persist in one
  transaction (AC 4).
- TDD: session-scoped reads and writes reject another child's identifiers, and
  expiration, logout, and throttling deny access (AC 2, 5).
- TDD: cross-site Origin or absent CSRF proof rejects every mutating server
  action before it reads or changes learning state (AC 6).
- TDD: parameterized SQLite access and purpose-bound audit fields prevent raw
  passwords, session tokens, and child answers in logs, client errors, or audit
  records (AC 9, 14).

**Stub:** `app/src/server/identity/identity.test.ts` and
`app/src/server/learning/learning.test.ts` are pre-written red stubs.
**stub:** true

**Approach:**
- Create schema initialization, focused repositories, password hashing, and
  session handling using server-only modules, including rotation, expiry,
  logout invalidation, throttling, and session-scoped record access.
- Seed a non-production child account only in the local development fixture.

**Done when:** integration tests prove login and persisted answer flow against a
temporary SQLite database.

### T4: Bound Pi Mono outputs, A2UI, and SVG diagrams

**Depends on:** T2, T3

**Touches:** app/src/server/agent/**, app/src/server/validation/**

**Tests:**
- TDD: unknown tools, components, fields, unsafe SVG markup, and out-of-range
  difficulty recommendations are rejected before persistence or rendering
  (AC 4, 7, 9, 10).
- TDD: the deterministic Pi-compatible fixture emits an approved question and
  diagram request through the same adapter boundary (AC 3, 7, 8).
- TDD: agent context is child-scoped and delimited, while request, retry,
  timeout, token, and cost limits reject excess work (AC 12).
- TDD: provider credentials and raw prompts are redacted from logs, client
  errors, and persisted agent audit records (AC 14).

**Stub:** `app/src/server/agent/agent.test.ts` and
`app/src/server/validation/payloads.test.ts` are pre-written red stubs.
**stub:** true

**Approach:**
- Add a server-only Pi Mono adapter with three registered learning actions and
  a provider-unavailable implementation, explicit context delimiting, and
  request, retry, token, and cost bounds.
- Define a small A2UI catalog and strict SVG/payload validators.

**Done when:** no invalid fixture payload reaches a renderer or changes progress,
and the reviewed fixture supplies the diagram happy path without a provider.

### T5: Deliver the child learning flow

**Depends on:** T3, T4

**Touches:** app/src/app/**, app/src/components/**

**Tests:**
- Visual/manual QA: the real app completes seeded sign-in, topic selection,
  answer submission, next question, progress feedback, approved fixture-diagram
  display, and the provider-unavailable state; record it in the named QA note
  (AC 1, 3, 4, 7, 8, 11, 15).
- Goal-based: `pnpm --filter child-math-app build` and `pnpm typecheck` pass
  (AC 1, 15).

**Approach:**
- Build the minimal sign-in, topic selection, question, diagram, answer, and
  progress surfaces with the reference architecture's restrained visual
  hierarchy.
- Use application-owned components rather than copied control-center code.

**Done when:** the documented local child-flow happy path is exercised on the
built app, and its build/typecheck and manual-QA evidence is recorded;
server-only acceptance criteria retain their automated evidence from T1–T4.

## Rollout

- **Delivery:** local development only. The SQLite database and development
  seed are disposable; no production migration occurs.
- **Infrastructure:** none beyond the local runtime specified in ADR-0001.
- **External-system integration:** none. Model provider and MCP connections are
  intentionally unavailable.
- **Deployment sequencing:** T1 through T5 run serially because later tasks
  consume their runtime, contracts, and persistence boundaries.

## Risks

- Node's SQLite API is still release-candidate status; T3 must prove the exact
  local runtime path before application work depends on it.
- Agent-generated content can be unsafe or malformed; validation remains inside
  the application boundary and is tested before UI integration.
- A seed catalog can drift from the official standard source; source revision
  metadata makes later review explicit.

## Changelog

- 2026-08-08: initial plan
