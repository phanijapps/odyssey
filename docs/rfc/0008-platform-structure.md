# RFC-0008: Platform-grade repository structure

- **Status:** Accepted — Tracks 1–2 shipped 2026-08-31; Track 3 items remain product decisions
- **Date:** 2026-08-31
- **Reference:** owner-provided platform monorepo layout (apps/{web,teacher-portal,docs,storybook} + packages/{ai,api,core,db,ui,lib,config,types} + tooling/ + turbo.json)
- **Prior art:** RFC-0007 (cal.com shape, shipped), structure deck v2 (Option 2 = domain packages, the "graduation path")

## The honest mapping first

The reference is a **product architecture**, not a folder theme. Adopting it
wholesale changes what Odyssey is. Each element, mapped:

| Reference element                                               | What it means for Odyssey                                         | Verdict                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `webapp`                                                        | our `web/` — renamed back under `apps/`                           | **Adopt when app #2 lands** (per RFC-0007: apps/ returns without regret)                                                                                                                                                                                                       |
| `apps/teacher-portal`                                           | a **fourth persona**: roster, assignments, real-time monitoring   | **Product decision** — Odyssey's personas are student/parent/admin today. Say yes and it becomes a spec, not a folder                                                                                                                                                          |
| `apps/docs`                                                     | a developer-docs site (Fumadocs/Starlight)                        | **Defer** — `docs/` markdown serves; a site earns itself when contributors arrive                                                                                                                                                                                              |
| `apps/storybook`                                                | UI component playground                                           | **Defer** — we have exactly 2 shared components; deleted the dead ones on purpose                                                                                                                                                                                              |
| `packages/ai` (agents, memory, providers, tools)                | agent runtime with TutorAgent, DiagnosticAssessor, session memory | **Product decision with guardrails** — RFC-0006 removed agent machinery deliberately; the brief forbids arbitrary agent tools. But the `QuestionGenerator` seam we built is exactly where a TutorAgent plugs in. Tutor mode is a legitimate, exciting roadmap item — as a spec |
| `packages/api` (tRPC/Hono)                                      | rewrite of the route-handler transport                            | **Refuse** — the HTTP surface IS the auth-proof boundary; e2e tests it; a transport rewrite buys nothing a child or parent can feel                                                                                                                                            |
| `packages/core` (BKT, SmartScore, prerequisite DAG, validators) | a real mastery-science upgrade                                    | **Product decision** — BKT/SmartScore over the current 3-level adaptive model is a learning-engine spec, the single highest-value item in the reference                                                                                                                        |
| `packages/db` (Prisma/Drizzle)                                  | ORM + schema management                                           | **Refuse** — local-first `node:sqlite` + WAL + ordered migrations is deliberate, zero-dependency, tested. An ORM is a forever-dependency and a full migration rewrite with no user value                                                                                       |
| `packages/ui` (Radix design system)                             | shared component library                                          | **Defer** — grows the moment tutor-mode or teacher-portal ship real UI                                                                                                                                                                                                         |
| `packages/lib`, `packages/config`, `packages/types`             | shared utils / base configs / shared Zod schemas                  | **Adopt config now** (real duplication today); lib/types as consumer count grows                                                                                                                                                                                               |
| `tooling/`                                                      | dev scripts + shared test config                                  | **Adopt now** — rename `tools/`, absorb stray scripts                                                                                                                                                                                                                          |
| `turbo.json`                                                    | pipeline orchestration                                            | **At 3+ packages or when CI minutes matter** — pnpm scripts suffice at two                                                                                                                                                                                                     |
| `.github/` (workflows, CODEOWNERS)                              | CI, quality gates                                                 | **Adopt now** — the single biggest "real project" signal we lack                                                                                                                                                                                                               |

## The plan — three tracks

### Track 1 · Professional surface (no product change, do first)

One pass, behavior-preserving, gates green throughout:

1. `.github/workflows/ci.yml` — lint + typecheck + unit tests (both packages) +
   production build on PR/push; `CODEOWNERS` with the owner.
2. `.github/workflows/e2e.yml` — the Playwright suite against a built app
   (boot-per-run; the harness rules are documented in `web/AGENTS.md`).
3. `tools/` → `tooling/` (`scripts/`, `vitest-config/` shared preset).
4. `packages/config/` — shared `typescript/` base (web + practice-engine
   dedupe today), `eslint/` + `prettier/` bases.
5. Root README structure section updated to match.

### Track 2 · Domain-package convergence (structure, medium)

The graduation RFC-0007 predicted — reference's `core`/`db` shapes, honest names:

```text
packages/
├── core/        # pure learning domain — absorbs practice-engine:
│                #   adaptive pool, bank, interactions, grading,
│                #   mistake-to-mastery, achievements, performance builders
├── db/          # persistence: sqlite client, ordered migrations,
│                #   repositories (node:sqlite stays; no ORM)
└── …
```

`web/` keeps `app/ modules/ components/` exactly as shipped; `server/`
thins to route-facing services that call `@odyssey/core` + `@odyssey/db`.
All 210 tests move with their modules; e2e proves behavior parity.
`apps/` returns the day Track 3 adds a second app.

### Track 3 · The product forks (owner decides; each becomes a spec)

1. **SmartScore/BKT mastery engine** (`packages/core/algorithms`) — Bayesian
   knowledge tracing behind the existing pool/selection seam. Recommended
   first: it makes every screen smarter without adding any screen.
2. **Tutor mode** (`packages/ai`) — a bounded TutorAgent at the
   `QuestionGenerator` seam: hint escalation, dialogue on wrong answers.
   Guardrails carry over verbatim: validated output, no arbitrary tools,
   server owns persistence.
3. **Teacher portal** (`apps/teacher-portal`) — roster/aggregation surface
   over the same SQLite store. Implies multi-household questions; the brief
   currently defers that.
4. **Storybook + docs site** — when 2–3 land and there is something to play with.

## What this plan refuses, and why (the not-a-yes-machine section)

- **Prisma/Drizzle** — dependencies are forever; our DB layer is 500 tested
  lines on a zero-dep native driver with WAL and append-only migrations.
- **tRPC/Hono transport rewrite** — risk without user value; the current
  boundary is proven by adversarial review + e2e.
- **Empty scaffolding** — every folder in the reference that Odyssey has no
  feature for stays out until its spec exists. Structure follows product,
  never the reverse.

## Decision requested

- Track 1: uncontroversial — say **go**.
- Track 2: say **graduate** (or hold at RFC-0007 shape).
- Track 3: pick any of **smart-score / tutor / teacher** and it gets a spec
  and its own build loop.

## Adoption record (2026-08-31)

Shipped: `.github/` (ci.yml, e2e.yml, CODEOWNERS) · `tooling/`
(hooks from tools/, shared Vitest node preset) · `packages/config`
(TypeScript base extended by core/db/ai) · `packages/core` (algorithms
adaptive-pool/grading/question-bank, validators interactions/payloads,
curriculum catalog + data) · `packages/db` (client + repositories
learning/gold/browse + catalog seeder) · `packages/ai` (providers,
versioned generation prompt, agent boundary, generator adapter) ·
`webapp` under the restored `apps/` wrapper. `web/server` thins to
identity + learning services; `persistence`, `validation`, `agent`, and
`curriculum` dissolve into packages. Dead `curriculum-model` deleted.

Deliberate deviations from the reference (no folder without a feature):
no `db/seeds/` (catalog data lives in core beside its parser), no
`bkt/`, `tutor/`, `ui/`, `types/`, `turbo.json`, storybook, or eslint
config dir — each lands with its spec per the plan's product tracks.
