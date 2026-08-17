# Plan: A2UI Learning Delivery

- **Spec:** [`spec.md`](spec.md)
- **Status:** Executing

## Approach

Adopt the official v0.9.1 React renderer as a constrained presentation adapter,
not an agent runtime. First prove a minimal Odyssey catalog over fixed existing
visual components. Then adapt server-issued question DTOs to interaction
surfaces and translate catalog actions into the existing token-bound APIs.
Performance uses the same renderer with a read-only evidence catalog. A parent
portal is a separate final phase after identity relationships exist.

## Constraints

- Add `@a2ui/react` and `@a2ui/web_core` only after exact version/API contract
  acquisition and RFC-0004 approval; no A2A, MCP, AG-UI, or agent-core addition.
- Target v0.9.1; v1.0 is Candidate and excluded.
- Reuse Pi AI only for optional validated prose, never UI/action authority.
- Preserve public non-A2UI routes until compatibility/migration evidence exists.

## Construction tests

**Integration tests:** full surface/action/replay path for all three question
types; catalog unknown-component/function/binding/action rejection; no answer
key in surface; Performance redaction; baseline non-A2UI regression.

**Manual verification:** keyboard and screen-reader-oriented flows for each
question type, loading/error/retry, visual parity with current Practice/Test,
and narrow viewport. Parent QA is deferred until relationship fixtures exist.

## Design (LLD)

### Dependencies & integration

`@a2ui/react` renders A2UI v0.9.1; `@a2ui/web_core` processes envelopes, data
model, bindings, and actions. Next route handlers use HTTP request/response for
initial/update surfaces and explicit server action POSTs. Streaming, A2A, AG-UI,
and MCP transports are not part of v1.

### Interfaces & contracts

Define an Odyssey catalog manifest with an allowlisted component/function set,
version, capability declaration, property bounds, binding paths, and action
schemas. Define server DTO→A2UI compiler contracts and A2UI action→existing
answer/request adapters. The server validates incoming actions before accessing
assignment/session state. A client may report a response value only; it never
submits scoring context.

### Component / module decomposition

- `server/a2ui/catalog.ts`: protocol version/catalog/action schemas.
- `server/a2ui/learning-surface.ts`: converts server question DTOs to surfaces.
- `server/a2ui/performance-surface.ts`: converts redacted evidence to surfaces.
- `components/a2ui/*`: fixed React catalog registrations wrapping existing
  cards, MathText, controls, and error states.
- route adapters: own authentication, token validation, and policy; no renderer
  logic.

### State & control flow

An initial server response creates a surface/data model. Selection/input remains
renderer-local until an explicit submit action. The submit carries only the
opaque assignment token plus schema-valid response. Server resolves the
assignment, grades once, returns a next/review surface, and ignores replay.
True/false is a two-choice specialization; text response obeys existing bounds
and parser policy. Performance emits read-only actions such as `practiceTarget`.

### Failure, edge cases & resilience

Protocol/version/catalog mismatch, malformed action, unsupported renderer
capability, expired/stale assignment, network retry, and surface hydration
failure show a fixed recovery component. No fallback parses arbitrary JSON or
renders raw response text as UI. Feature flags/route selection allow the old
surface during staged parity verification.

### Quality attributes (NFRs)

Keep catalog node/property/text/action counts bounded. Validate before render
and before mutation. Maintain visual/accessibility parity, no-store child data,
and server-derived authorization. Measure only coarse renderer failure events
if separately approved.

## Tasks

### T1: Acquire the official renderer contract and freeze the Odyssey catalog

**Status:** Complete. `@a2ui/react@0.9.1` resolves against
`@a2ui/web_core@0.9.2`; Odyssey explicitly uses only their v0.9 entrypoints.
The initial local catalog is `OdysseyColumn`, `OdysseyText`, and
`OdysseyStatus`, with no functions, bindings, data model, or actions.

**Depends on:** none

**Tests:** typed compile probe against exact installed packages; catalog schema
fixtures for every allowed/denied component, prop, binding, function, action,
and protocol version.

**Approach:** record dependency versions in RFC/AGENTS, register minimum fixed
components, choose supported capabilities, and specify HTTP lifecycle/action
transport.

### T2: Render read-only A2UI surfaces with visual parity

**Status:** In progress. The fixed client adapter validates a server-issued
Performance document before processing it and is covered by authenticated
browser rendering; wider visual/accessibility QA remains.

**Depends on:** T1

**Tests:** renderer integration for server surface, unknown rejection, loading/
error recovery; manual keyboard/mobile/style comparison.

**Approach:** mount A2UI React renderer behind a small adapter and map catalog
entries to existing fixed components without moving grading/state policy.

### T3: Add server-owned question interaction DTOs

**Status:** In progress. Practice now issues a bounded versioned
`text-response` interaction DTO alongside its existing opaque assignment; Test
also returns the same bounded DTO with no answer material. Both current
text-response surfaces validate and consume the server-issued maximum-length
bound through the fixed A2UI catalog. Multiple-choice and true-false source
support and A2UI rendering remain deferred.

**Depends on:** T1

**Tests:** TDD item response schemas/validation for multiple-choice,
true-false, and text-response; no answer key surface assertions.

**Approach:** extend app-owned question schema/item sources with a discriminated
interaction type; keep generated/provider output constrained and validate it at
server boundary.

### T4: Bind A2UI actions to token-bound Practice and Test grading

**Status:** In progress. Server-compiled Practice and Test text-response
surfaces use only `/answer` local binding and fixed `practice.submit` and
`test.submit` events. The client parses each source/surface/context before a
hardcoded post to its existing answer route; opaque assignment tokens remain
the grading authority. Other interaction-type actions remain deferred.

**Depends on:** T2, T3

**Tests:** end-to-end surface→submit→grade→next/review/replay/stale/tamper
matrix for all interactions; existing route compatibility regression.

**Approach:** write narrow action adapters to existing assignment services;
never make renderer data model a persistence authority.

### T5: Emit A2UI Performance insight surfaces

**Depends on:** T2, `spec:mistake-to-mastery/T3`, `spec:performance-guidance/T3`

**Tests:** redacted evidence/action/capability/unknown-surface tests and manual
empty/sparse/ready/error visual QA.

**Approach:** compile deterministic Performance DTO to the catalog; add optional
Pi prose only after a separate safe-schema review.

### T6: Shape and implement parent relationship foundation

**Depends on:** T5

**Tests:** parent-child link/revocation/one-to-many policy/route-isolation tests.

**Approach:** this is a separate approved parent-auth spec; it blocks any parent
Performance surface or dynamic insight sharing.

## Risks

- A2UI adds a new dependency/protocol boundary; mitigate through pinned v0.9.1,
  typed contract probes, strict catalog/action validation, and staged parity.
- A2UI data binding can broaden client authority; mitigate through minimal
  local state, explicit submit, and server token resolution.
- Multiple interaction types can weaken grading; mitigate through discriminated
  server schemas and per-type answer tests.
- Parent portal can leak child data; block it behind relationship/revocation
  design and tests.

## Changelog

- 2026-08-16: Drafted after user selected official A2UI integration.
- 2026-08-17: Implemented the bounded learner Performance foundation; question actions remain deferred.
