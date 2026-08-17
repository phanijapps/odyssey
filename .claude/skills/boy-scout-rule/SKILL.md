---
name: boy-scout-rule
description: Apply the Boy Scout Rule (a.k.a. Scout Rule, campsite rule) — leave code you touch slightly cleaner than you found it — without scope creep. Use while implementing fixes or features in files that carry small nearby defects (stale comments, unused imports, dead branches, misleading local names), when the user asks to "clean up while you're in there", "leave it better than you found it", "tidy as you go", or to review a diff that bundles opportunistic cleanup with a fix. Defines the three gates every bundled cleanup must pass and routes everything bigger to named follow-up work. Not for planned whole-module refactors (use clean-code), dedicated codebase-wide sweeps, or rewrites.
---

# Skill: boy-scout-rule

Leave each touched area a little cleaner than you found it — **only** when the
cleanup passes three gates, and **never** as the thin end of a redesign.

The rule exists because code rots. Every file accumulates small lies while
nobody is looking: a comment the last change falsified, an import the last
deletion orphaned, a branch the last feature made unreachable. Nobody files a
ticket for those. The rule is the ratchet that turns during work that was
going to happen anyway — which is why its *bounds* matter more than its
exhortations. An unbounded ratchet is just an unrequested refactor wearing a
uniform.

## The three gates

A bundled cleanup may ride along with the requested change **only if it
passes all three gates**. Fail any gate → record a follow-up instead.

| Gate | Test | Why |
|---|---|---|
| **Mechanical** | Requires no design decision; a reviewer can verify it by inspection, not by reasoning about behavior | A cleanup that needs a judgment call is a change in disguise — it deserves its own review, not a ride-along |
| **Same-concern** | Same file, same reason-to-change as the requested work | Bundling unrelated concerns makes the diff lie about its purpose and hides the real change from review |
| **Smaller** | Strictly smaller than the requested change, in lines and in risk | When the cleanup outweighs the fix, review attention inverts and the requested change stops being the thing anyone verified |

Canonical in-scope examples: a stale comment the change falsified, an unused
import in the touched file, a dead branch the change exposes, a misleading
local name inside the touched scope, a missing boundary check the change
reveals. If you find yourself arguing for the cleanup, it has already failed
the mechanical gate — argument is judgment, judgment is design.

## Out of bounds, always

These fail a gate by construction; record them as follow-up work instead:

- Renaming or removing a public/exported symbol (contract change, needs
  caller analysis — not mechanical).
- Changes crossing a file boundary the request didn't cross.
- Reformatting or restyling lines the change doesn't touch (the formatter
  owns that job).
- Extracting functions, introducing abstractions, or "improving" structure.
- Adding or upgrading a dependency.
- Anything requiring a test-design decision to prove safe.

## Procedure

1. **Make the requested change.** The cleanup is a rider, never the horse.
2. **Sweep the touched scope** (the function or file you actually edited)
   for gate-passing defects. Fix those; leave the rest.
3. **Name every bundled cleanup** in the commit message or PR description
   with a one-line reason ("also: removed unused `node:fs` import orphaned by
   this change"). An unnamed rider is how scope creep ships — the naming is
   what lets a reviewer veto it cheaply.
4. **Record the surplus** — everything you noticed but declined — as
   follow-up items (a note in the PR description, or the repo's follow-up
   channel). Declining to fix is fine; *forgetting* you saw it is the failure
   the ratchet exists to prevent.
5. **Calibrate to test coverage.** Confidence in "behavior unchanged" comes
   from the tests that surround the change. In code with thin or red
   coverage, raise the bar: only cleanups that are provably inert (comments,
   dead code the compiler can confirm) ride along. Fowler's bound is
   instructive: refactor opportunistically when the tests are green, and
   know when to call it a day.

## The agent-specific calibration

Human review is the bottleneck for agent-authored diffs, and review bandwidth
does not scale with agent output. Two consequences:

- **When in doubt, list instead of fix.** "Noticed X and Y; not touching
  them here" costs the reviewer five seconds; a bundled X and Y costs a
  re-read of the whole diff. Practitioner guidance for agent workflows
  converges on the same default: no opportunistic cleanup beyond the
  gate-passing minimum; the rest goes on a follow-ups list.
- **Prefer sequencing over bundling when cleanup is genuinely needed** for
  the change: cleanup commit first (separate, reviewable), requested change
  second. A reviewer can then verify each diff against one intent.

## Terminology

"Boy Scout Rule" remains the dominant software term (see
[lineage](references/lineage.md) for the Baden-Powell → Robert C. Martin
lineage, exact quotes, and the 2025 Scouting America rename). "Scout Rule"
and "campsite rule" are common aliases; treat them as this skill.

## Reference modules

Read on demand — the skill body above is the operative contract.

- [`references/lineage.md`](references/lineage.md) — where the rule comes
  from, with primary sources: Baden-Powell's 1941 farewell message, Clean
  Code Ch. 1 (2008), Martin's "The Boy Scout Rule" essay (2010), and the
  terminology drift.
- [`references/opportunistic-refactoring.md`](references/opportunistic-refactoring.md)
  — Fowler's taxonomy (opportunistic vs. preparatory vs. planned), the
  conditions under which opportunistic work is safe, and where it sits
  relative to this repo's process.
- [`references/failure-modes.md`](references/failure-modes.md) — the
  documented ways the rule goes wrong (scope creep, review traceability,
  merge friction, churn) and what the churn research does and does not say.
- [`assets/cleanup-decision.md`](assets/cleanup-decision.md) — the three
  gates as a portable decision tree, with commit-note and follow-up
  templates.

## Relationship to sibling skills

- **`clean-code`** defines what "clean" means (names, function shape,
  comments, error handling). This skill defines *when* and *how much* to
  clean during unrelated work. Cleaning at the right time with the wrong
  standard, or the right standard at the wrong time, both produce bad diffs.
- **`work-loop`** already encodes this skill's carve-out as the
  *bundled-fixes* rule (same-area, same-concern, mechanical ride-alongs
  only; surplus to follow-up). This skill is the depth behind that line.

## Anti-patterns to refuse

- **Cleanup as pretext.** "While I was in there I also restructured…" —
  if the rider needs the word "restructured", it is not a rider. Decline,
  record follow-up.
- **Silent bundling.** Fixing nearby cruft without naming it in the commit.
  The diff and its description must account for every hunk.
- **The entitled rewrite.** The campground rule does not confer redesign
  rights on every file you camp in. Touch ≠ own.
- **Deferring everything.** A ratchet that never turns is decoration.
  Gate-passing cleanups that are declined anyway (out of caution or
  indifference) rot forward — the codebase keeps every lie it accumulates.
  Fix what passes the gates; list the rest.
