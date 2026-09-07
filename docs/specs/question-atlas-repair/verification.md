# Question atlas repair verification

Checked on 2026-09-07 against the production build and isolated learning and
curriculum stores. No deployment or production-data mutation was performed.

## Automated evidence

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.
- 262 deterministic tests pass: core 33, AI 47, database 21, webapp 161.
  The baseline had 213 passing tests but no integrated atlas coverage.
- Core walker regressions cover unordered first nodes, prerequisite eligibility,
  sibling selection, deepening, widening, and no repeated nodes (AC3).
- Thirty generator cases cover malformed envelopes, independent pruning, field
  bounds, unsafe SVG, duplicate questions, coverage, and disabled generation (AC4).
- Fourteen SQLite route cases cover single-launch concurrency, assignment retention,
  stale A→B→A completion, expiry, logout, explicit restart, long reviewed topic
  identities, scoring, and answer-driven selection (AC1–3, AC5–6).
- The provider transport test failed before adding the missing reasoning control;
  it now verifies the actual request emitted by the installed SDK.
  A failure-path test proves at most two transport attempts; changing the retry
  cap from one to two made that test fail, then the production cap was restored.
- Six existing browser journeys pass. The additional production atlas journey
  uses the real catalog seeder, route handlers, completion SDK, and validation,
  with a deterministic local model endpoint. It covers loading, 12 unique
  questions, same-tier recovery after a mistake, no per-answer generation,
  completion, failed-round retry, and a held answer response during skill change.
  The existing E2E workflow runs this production journey before the development suites.
  The skill-switch assertion failed against the previous build and passed after
  clearing submitting state and invalidating stale responses.
- Desktop and 390-pixel mobile screenshots show the diagram, answer controls,
  progress ordinal, and completion state; the mobile page has no horizontal
  overflow. The browser reports no uncaught page errors.

## Live provider contract

Oracle tiers: installed TypeScript API/source (Pi AI 0.84.1), official endpoint
contract, and a live runtime probe. The SDK merges `samplingParams` into the
outgoing completion body. The endpoint supports
[`reasoning_effort: "low"`](https://docs.ollama.com/api/openai-compatibility).

Before the repair, an observed completion exhausted its token budget before
producing question JSON. The completion boundary now requests low reasoning
effort explicitly, without increasing its token or retry limits. The live probe
also showed that SDK `timeoutMs` covers transport inactivity, not total streaming
duration. An explicit abort timer now enforces the overall deadline, including
retries; a partial-stream regression hung before this fix and passes afterward.
The timer is cleared on both success and failure.

The first low-effort app response contained 12 JSON nodes but used single-quoted
SVG attributes, which the existing validator rejects. The prompt now explicitly
requires double-quoted attributes escaped inside JSON. The validator was not
relaxed. With both changes, the production app accepted all 12 nodes and served
the first foundational question with a diagram and position 1 of 12 in 25.2
seconds. This exercised the configured live model, validation, session handoff,
and assignment projection with fresh isolated data. No model configuration file
was changed.

A separate browser run against the same live configuration loaded a valid
14-node batch in 44.1 seconds, answered all 14 distinct assignments through the
normal form, and reached the completed-round screen. This uses the accepted
4–15-node batch contract; the runtime total reflects validated nodes rather
than assuming the prompt always returns exactly 12. Answer keys were read only
from the isolated test store to drive this QA journey.

Earlier unsuccessful probes were rejected and left retry available. These
checks establish a working integration, not guaranteed availability or a proof
of mathematical correctness for every generated question.

## Review dispositions

- Applied: initial spec review clarified exact batch bounds, route lifecycle,
  deadline/restart semantics, security inputs, and documentation scope.
- Applied: security spec review restricted prompts to one reviewed standard and
  made completion limits explicit.
- Applied: implementation review found stale submitting state on skill change;
  the production browser regression reproduced it before the fix.
- Applied: living architecture no longer claims nonexistent package guides or
  that the provider is the only module importing the AI SDK.
- Applied: the route atlas fixture now satisfies the generated solution-step bound.
- Applied: quality review added transport retry-cap verification, a pending
  generation/accepted-answer interleaving, and semantic prompt assertions.
  Provider, invalid-batch, and expired failures now emit one redacted server
  event when the failed state is committed, with only a reason bucket and
  reviewed standard code. Tests verify those fields exclude provider/session data.
- Named skips: experience/frontend specialist roles are unavailable; direct
  production browser inspection supplies the visual check.
- Clarification disposition: the initial question graph was interpreted as the
  existing Skill Atlas. The asynchronous clarification received no correction;
  work proceeded on the stated assumption and existing design.

Final adversarial, security, and quality reviews returned **Clean — ready to commit.**
All findings above were applied and the affected gates rerun.

## Known limitations and follow-up

The first remote checks stopped during package-manager setup because the
workflows declared pnpm `10` while `package.json` pins `10.0.0`. Both workflows
now use the manifest's existing pin; no dependency version was changed.

The dependency audit exits 1 with four high and two moderate pre-existing
transitive advisories; the lockfile is unchanged. It is not a clean security scan.
The [technical-debt register](../../product/technical-debt.md) records those
advisories, reviewed-bank coverage, governance drift, and the other scoped-out
findings, with corresponding workspace backlog entries. Generated mathematical
correctness still needs independent curriculum evaluation; shape validation does
not prove every answer correct.
