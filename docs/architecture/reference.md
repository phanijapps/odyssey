# Reference architecture

> **Normative.** New implementation conforms to this foundation unless a later
> ADR records a deliberate change.

## Constraints

- **Runtime.** TypeScript and Next.js run on Node.js 24.19.0 or later.
- **Local persistence.** SQLite is the initial source of truth for accounts,
  learning progress, and approved generated learning artifacts.
- **Curriculum source.** A versioned JSON catalog owns the in-product mapping
  of grade or course, topic, standard identifier, and official-source metadata
  for Ohio Learning Standards for Mathematics.
- **Child safety.** Model output and all user input are untrusted at the server
  boundary. No generated executable code reaches the browser.
- **Scope.** The first experience is child-facing math practice for grades
  6–12. Parent workflows, other subjects, and production deployment are out of
  the first slice. ADR-0003 includes a local-only, server-side Engram profile
  memory boundary.

## Solution strategy

- **Application shape.** A Next.js application owns browser UI, server actions
  or route handlers, persistence, and access control in a single local-first
  deployable unit exposed through one port. A separate API process is not part
  of the initial architecture.
- **Repository layout.** `app/` owns the deployable application. `packages/`
  holds only focused code with two real consumers; it never hosts a second
  deployable application or a catch-all utility layer.
- **Agent runtime.** Pi Mono's agent core runs only on the server. It selects
  learning content through registered tools and never owns database writes,
  authorization decisions, or unrestricted network or filesystem access.
- **Agent-generated UI.** A2UI is limited to an application-owned, versioned
  catalog of declarative components. The application validates every payload
  before rendering it.
- **Generated diagrams.** A server-side validator accepts only an allowlisted
  SVG shape and label vocabulary before a diagram is persisted or displayed.
- **Configuration.** Repo-owned skills define narrow topic, question, diagram,
  and progression configurations. New MCP capabilities require a spec and a
  tool-level authorization decision.

## Building blocks

- **Child portal.** Renders the selected topic, a question, an optional
  validated diagram, answer controls, and progress feedback.
- **Curriculum catalog.** Supplies reviewed, versioned topic and standards
  metadata to the learning service and agent adapter. It is not editable by the
  agent at runtime.
- **Learning service.** Owns topic state, answer evaluation, progression rules,
  and durable progress records.
- **Identity service.** Owns password verification, sessions, and the child
  account boundary; it never exposes password material to the agent.
- **Agent adapter.** Wraps Pi Mono, supplies narrow context, invokes only
  registered tools, and validates structured outputs.
- **A2UI catalog renderer.** Maps validated declarative component descriptions
  to application-owned React components.
- **SQLite repository.** Encapsulates persistence behind application services.
- **Profile-memory adapter.** Wraps a verified local Engram native artifact,
  projects only derived child-scoped signals, and seeds an application-owned
  ontology and taxonomy. It is not a browser surface or agent tool. The
  preferred future source is the installed `@engram/node` package from the
  Engram Git `main` branch; `ENGRAM_NODE_PACKAGE_PATH` remains a local artifact
  override. The current package declares `@engram/contracts` as a workspace
  dependency, so Git installation should use a checked-out Engram workspace or
  a published compatible package until that upstream contract changes.

## Crosscutting standards

- Validate at all trust boundaries with typed schemas; reject unknown fields and
  unsafe SVG elements, attributes, and URL-bearing values.
- Store passwords only as salted, slow hashes; keep credentials and model API
  keys server-side and out of logs.
- Record agent requests, tool names, validation outcomes, and content versions
  without logging child answers or secrets unnecessarily.
- Test progression and validation logic with deterministic tests; test the
  real child flow and rendered diagram manually before release.
- Keep generated learning content attributable to its topic, skill version,
  and validation result so it can be reviewed or removed.
- Keep modules cohesive and narrowly named; do not create god classes,
  catch-all services, or components that own rendering, persistence, agent
  orchestration, and validation together.
- Write clear code first. Comments capture rationale, constraints, and
  non-obvious tradeoffs rather than narrating the code. Improve nearby code
  only when it is a small, same-concern cleanup required by the change.
