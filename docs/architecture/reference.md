# Reference architecture

> **Normative for new implementation.** This is the current foundation. Frozen
> ADRs and RFCs record decisions made at a point in time; a historical record
> does not override this document when the implementation has changed.

## Constraints

- **Runtime.** TypeScript and Next.js run on Node.js 24.19.0 or later in one
  local-first application process.
- **Persistence.** SQLite is the authoritative local store. The centralized
  persistence module owns connection policy and ordered migrations for both
  learning and curriculum data.
- **Curriculum.** Reviewed Gold records are the only approved curriculum input
  to learning, assessment, and retrieval. Bronze and Silver are workflow
  states, not learner-facing content.
- **Safety.** User input and model output are untrusted at the route boundary.
  Generated content is validated before persistence or rendering; no generated
  executable code reaches the browser.
- **Scope.** The product is local math practice for grades 6–12, with local
  progress support and curriculum administration. Other subjects and production
  deployment remain out of scope.

## Solution strategy

- **Application shape.** `app/` owns browser UI, App Router handlers, and
  focused server modules. There is no second service and no reusable package
  boundary until a real second consumer exists.
- **Transport boundary.** Routes are same-origin adapters: validate transport
  input, derive server-side session scope, invoke a focused service, and return
  a safe projection. Authorization and persistence policy stay out of browser
  components.
- **Completion boundary.** `src/server/pi-completion.ts` is the only Pi AI
  provider boundary. It makes bounded, stateless, text-only local completions.
  It does not expose tools, an agent loop, filesystem access, database writes,
  or authorization decisions. Do not introduce A2UI or Pi-agent-core concepts
  into new designs without an approved architectural change.
- **Persistence boundary.** `src/server/persistence/sqlite.ts` opens and
  migrates application databases. Feature modules use its connections and
  transactions rather than creating schemas or competing migration paths.
- **Learning boundary.** `src/server/learning/` owns practice progression,
  assessment lifecycle, and redacted learner history. Assessment state and
  formative mastery are deliberately separate.
- **Curriculum boundary.** `src/server/curriculum/` owns catalog reading,
  promotion, Gold persistence, vectors, and retrieval. Its Pi-named workflow
  adapter obtains structured completion data but application code validates and
  promotes records.
- **Native-memory boundary.** `src/server/memory/` contains optional,
  server-only Engram adapters. They project allowlisted derived signals and are
  recoverable when unavailable; they never become the authority for learning
  progress or curriculum.

## Crosscutting standards

- Validate all route input and all generated payloads with narrow schemas;
  reject unknown fields at public boundaries.
- Derive learner and administrative scope from the server-side session. Every
  state-changing route uses the shared same-origin mutation proof, except where
  a route's documented session lifecycle is intentionally narrower.
- Keep answer keys, raw submitted answers, provider internals, and internal
  error detail out of client projections and durable attempt history.
- Treat local semantic retrieval as an optional vector projection over Gold:
  bounded nearest-neighbor results may fall back to text search. Do not describe
  it as graph retrieval, hybrid retrieval, or reranking unless implementation
  adds those stages.
- Keep modules cohesive and named for their policy. Do not create catch-all
  services, browser-side persistence, or a second database migration owner.
- Preserve route paths and response shapes as compatibility surfaces. Update
  [`application.md`](application.md#public-route-contracts) in the same change
  as any route contract.
- If deployed outside local development, configure `ODYSSEY_APP_ORIGIN` as the
  exact public HTTPS origin. Generic development fixtures require explicit local
  enablement and are refused in production; production account material is
  provisioned out of band and never committed to configuration or docs.
- Write comments for constraints and trade-offs, not narration. Make nearby
  cleanup only when it is a small same-concern change required by the work.

## Contributor guidance hierarchy

Read the root [`AGENTS.md`](../../AGENTS.md) first, then
[`apps/web/AGENTS.md`](../../apps/web/AGENTS.md) for the deployable app's
boundaries (routes, server modules, test isolation, e2e harness). The former
per-subtree guides were consolidated into that single file.
