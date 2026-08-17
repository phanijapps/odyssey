---
name: clean-code
description: Apply clean-code discipline when writing, changing, or reviewing code — intent-revealing names, functions that do one thing at one level of abstraction, honest error handling, comments that carry constraints instead of narration, and deletion of dead code. Use for any implementation, refactoring, or maintainability/code-quality review, and whenever the user asks to keep code clean, apply SOLID, or review a diff for quality before merging. Calibrates Robert C. Martin's Clean Code heuristics against the actual evidence (function-length studies, Ousterhout's deep modules, the 2025 debate) and this repo's minimal-diff principle. Not for security review (security-checklists), for deciding how much opportunistic tidying may ride along (boy-scout-rule), or for formatting (the formatter's job).
---

# Skill: clean-code

A discipline to apply **while changing code** — not a license for unrelated
rewrites. The bar: a maintainer who has never seen the file can read your
diff, understand what each piece does and why it exists, and trust that
nothing you touched now lies.

This skill is calibrated, not devotional. Clean Code (2008) supplies the
vocabulary; two counterweights keep it honest:

1. **The evidence.** The book's most famous rule — very small functions —
   is its least-evidenced: Martin concedes in the book itself that he
   "can't provide any references to research that shows that very small
   functions are better," and the pre-2010 defect studies mostly favor
   *longer* modules (sweet spots ~100–225 LOC). Meanwhile Ousterhout's
   *A Philosophy of Software Design* argues tiny-function style produces
   **shallow, entangled** methods. See
   [`references/evidence.md`](references/evidence.md) before citing any
   of this in review notes — the nuances matter.
2. **The repo's minimal-diff principle.** Code is a liability; unrequested
   changes hide the requested one from review. This skill governs the
   quality of what you write and touch; `boy-scout-rule` governs how far
   cleanup may spread beyond it.

## Core rules

### 1. Names

Make names describe domain intent. Avoid generic `data`, `utils`,
`manager`, `temp`, `info` and boolean ambiguity (`flag` — of what?).
Prefer `is`/`has` prefixes for booleans, and use one word per concept
across the codebase (don't mix `fetch`/`get`/`load` for the same action).
Scope and name length trade off: longer names for longer-lived (exported,
wider-scope) bindings; short names are acceptable only where the context
is a few lines. **Exported names are public contracts**: renaming one is
caller-analysis work, never a cleanup — improve the names of things you
add or of locals inside the touched scope, and record export renames as
follow-up. Depth: [`references/naming.md`](references/naming.md).

### 2. Functions

Keep a function to **one policy or state transition at one level of
abstraction** — SQL, business rules, and serialization don't belong in the
same function body. Prefer few arguments; never a boolean flag parameter
that switches behavior (two functions read better than one with a mode
switch). Separate commands (change state, return nothing) from queries
(answer something, change nothing). No hidden side effects.

**When to extract:** apply the book's extraction test — extract when you
can name the extracted piece "with a name that is not merely a
restatement of its implementation." `validateAttempt()` passes; the
sibling of `processLoop()` does not. In *existing* code, this repo's rule
governs: extract only after a real second caller appears, or when a
security/transaction boundary needs a named seam. Line count is not a
target; readability at one sitting is. Depth — including the deep-modules
counterpoint and why splitting a loop can cost 3–4× performance:
[`references/functions.md`](references/functions.md).

### 3. Comments

Put comments on **constraints, decisions, non-obvious invariants, and
provenance** ("8 per grade band — product ruling, 2026-01 standup"), and
delete comments that narrate code (`// loop over rows`). When your change
falsifies a comment, fix the comment in the same change. Both poles of the
book are real quotes — "nothing can be quite so helpful as a well placed
comment" and "comments are always failures" — and the 2025 Ousterhout
debate is precisely about which pole to weight; see
[`references/comments-and-formatting.md`](references/comments-and-formatting.md).
Formatting itself is the formatter's job; never hand-restyle untouched
lines in a review or a diff.

### 4. Errors and boundaries

Don't hide failures with broad catches or `any`. Prefer the codebase's
error idiom (exceptions or explicit result types); give errors context
(child id, topic, what was attempted). Don't return `null` where an empty
collection or a named special case expresses the situation. At trust
boundaries — user input, external APIs, deserialization — validate and
convert to typed data on entry, then trust internal callers; wrap
third-party APIs behind your own interface so their churn doesn't spread.
Depth: [`references/errors-and-boundaries.md`](references/errors-and-boundaries.md).

### 5. Tests

Test **behaviors, not methods**; one concept per test, minimal assertions,
descriptive names that read as documentation of the behavior. F.I.R.S.T.:
Fast, Independent, Repeatable, Self-validating, Timely. Dirty tests are
worse than no tests — a lying suite is more dangerous than an absent one.
The repo's TDD conventions (see `work-loop`) govern the workflow; this
skill governs test *quality*. Depth:
[`references/tests.md`](references/tests.md).

### 6. Deletion

Remove code your change makes unreachable (dead branches, orphaned
imports, superseded helpers with no remaining callers *in this change's
scope*). Do not refactor adjacent working code without an approved need —
that is `boy-scout-rule` territory, and its gates apply.

### 7. Review posture

Before declaring done, read the diff as a new maintainer would: each file
should have one clear reason to change; each public function an evident
caller and contract; each hunk attributable to the request (plus named
gate-passing riders). Run the checklist in
[`assets/review-checklist.md`](assets/review-checklist.md).

## The tiebreaker: Beck's four rules, in order

When two heuristics conflict, *A Philosophy of Software Design*'s
deep-module lens and Clean Code Ch. 12's emergent design converge on a
priority order worth memorizing — Kent Beck's rules of simple design:

1. **Runs all the tests** (correctness dominates everything).
2. **Contains no duplication** (knowledge expressed once).
3. **Expresses the intent of the programmers** (reads like what it does).
4. **Minimizes the number of classes and methods** — note this rule
   *caps* the extraction instinct. Even the book appends a brake to
   extract-till-you-drop; apply it.

If a proposed cleanup improves a lower rule while damaging a higher one,
decline it.

## SOLID, calibrated

The five principles (SRP, OCP, LSP, ISP, DIP) are useful vocabulary with
a real lineage — OCP from Meyer (1988), LSP from Liskov (1987), the set
assembled and acronymized (by Michael Feathers, ~2004) from Martin's 2000
"Design Principles and Design Patterns." Apply them as questions to ask
at real seams, not as a mandate for interface ceremony: ISP and DIP
misapplied produce interface bloat, and SRP read as "one function per
activity" produces shallow classes. In this repo, SRP means *one reason
to change per module*; structure follows that, not a class count. Depth,
origins, and critiques: [`references/solid.md`](references/solid.md).

## Reference modules

Read on demand; the body above is the operative contract.

| Module | Read when… |
|---|---|
| [`references/naming.md`](references/naming.md) | choosing or reviewing names; naming-convention debates |
| [`references/functions.md`](references/functions.md) | function design, decomposition decisions, the small-vs-deep tension |
| [`references/comments-and-formatting.md`](references/comments-and-formatting.md) | whether a comment earns its place; the comments debate |
| [`references/errors-and-boundaries.md`](references/errors-and-boundaries.md) | error-handling strategy; wrapping third-party/external boundaries |
| [`references/tests.md`](references/tests.md) | writing or reviewing test quality |
| [`references/solid.md`](references/solid.md) | applying or critiquing the five principles |
| [`references/smells-heuristics.md`](references/smells-heuristics.md) | diff review; naming a smell precisely (verified C/E/F/G/J/N/T catalog) |
| [`references/evidence.md`](references/evidence.md) | about to cite "research shows…" in a review — read this first |

## Sibling skills

- **`boy-scout-rule`** — when and how much cleanup may ride along with a
  change; this skill defines what "clean" means, that one bounds the ride.
- **`work-loop`** — the process loop this discipline serves; its
  verification modes and bundled-fixes carve-out reference back here.
- **The linter** — mechanical style rules live in tooling, not prose.
  Never write a review comment a linter could have caught.

## Anti-patterns to refuse

- **Extract-till-you-drop.** Decomposing below the nameable-idea
  threshold produces shallow, entangled units and can cost real
  performance. Beck's rule 4 is the brake.
- **Clean-code-as-pretext.** "It was messy, so I rewrote it" — the
  request governs scope; quality governs what the request touches.
- **Numeric function-length gates.** No line count is a rule; the
  evidence doesn't support small-number targets, and the book admits it.
- **Ceremony refactoring.** Interface-per-class, factory-of-factories,
  dependency injection where there is one implementation and no seam
  pressure. SOLID misapplied is boilerplate with a pedigree.
- **Narrating comments restored** in the name of documentation. Comments
  carry what code cannot say: why, constraints, provenance.
