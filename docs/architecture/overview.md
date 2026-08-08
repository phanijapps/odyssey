# Architecture Overview

> The map of this monorepo. Read this first when exploring. Updated whenever
> the directory layout or major dependencies change.

## Layout

```
.
├── AGENTS.md             # canonical agent context (CLAUDE.md is a symlink)
├── app/                  # single deployable Next.js child-learning application
├── packages/             # shared libraries (consumed by apps and other packages)
│   └── <package-name>/
├── tools/                # build, dev, and ops tooling — not shipped to users
├── docs/
│   ├── CHARTER.md        # mission, scope, principles (one page)
│   ├── CONVENTIONS.md    # how we work
│   ├── adr/              # architecture decisions (frozen history)
│   ├── rfc/              # proposals (governance)
│   ├── specs/            # feature specs and plans
│   ├── architecture/     # this directory — current code structure (for contributors)
│   ├── product/          # current product state (roadmap, changelog) — for maintainers
│   └── guides/           # user-facing docs (Diátaxis: tutorials, how-to, reference, explanation)
├── .claude/
│   ├── skills/           # agent workflows for repeating tasks (each skill owns its templates under `assets/`)
│   ├── agents/           # subagent definitions
│   └── commands/         # custom slash commands
└── .github/              # CI, issue and PR templates
```

## Apps and packages

- `app/` — Next.js child-learning application. Depends on React, Next.js, and
  the server-only Pi Mono runtime. Entry point: `app/src/app/page.tsx`.
- `packages/curriculum/` — reusable, typed curriculum parsing and progression
  contracts. Entry points: `packages/curriculum/src/catalog.ts` and
  `packages/curriculum/src/progression.ts`.

## Conventions you'll see across packages

- The application and its server behavior run through one Next.js process and
  one local port.
- `app/` owns runtime integrations; reusable curriculum logic stays in
  `packages/curriculum/`.

## Where to start

<!--
A short, opinionated path for someone new to the repo. Example:

1. Read [`docs/CHARTER.md`](../CHARTER.md) — the project's mission and scope.
2. Read this file (architecture overview).
3. Skim [`docs/product/roadmap.md`](../product/roadmap.md) for current direction.
4. Read the child-math-practice spec and plan beside `app/` and
   `packages/curriculum/`.
5. Look at the latest 3 ADRs in `docs/adr/` to see the kinds of decisions
   we record.
-->
