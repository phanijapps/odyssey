# Naming — Clean Code Ch. 2, the N-heuristics, and the evidence

## The book's heuristics (Ch. 2, "Meaningful Names")

- Names reveal **intent**: what it does, why it exists, how it is used.
  If a name needs a comment to explain it, the name is not doing its job.
- Avoid `data`, `info`, `temp`, `util`, `manager`, `helper`, `process`,
  `handle` — names that could describe anything and therefore describe
  nothing.
- **One word per concept** across the codebase: pick `fetch` *or* `get`
  *or* `load` for the same action and stay consistent; don't make a
  reader wonder whether `fetchX` and `getX` differ.
- **Don't encode type or scope noise** the language already carries
  (member prefixes, Hungarian-style tags) — but do let scope guide length:
  short names for few-line scopes, longer names for exported/wider
  bindings. (This scope↔length trade-off was one of the live disagreements
  in the 2025 Ousterhout–Martin debate: Martin defends long
  "megasyllabic" names for anything that outlives its screen.)
- Booleans read as predicates: `isExportable`, `hasAttemptsLeft` — never
  `flag` or `ok` where the reader must reverse-engineer the polarity.
- Class/function names carry the **domain** vocabulary (`promoteLevel`,
  `streakDecay`), not the storage vocabulary (`updateRow`, `writeRec`) —
  unless the function is genuinely about storage.

## Smells & Heuristics appendix, N-series (verified ranges)

The appendix runs **N1–N7**: N1 Choose Descriptive Names → N7 Names
Should Describe Side-Effects. (Web lists renumber these; cite the book's
ranges — see [`smells-heuristics.md`](smells-heuristics.md).) N7 is the
one reviewers forget most: `getResponse` that also resets the session is
a lie, not just a smell.

## What the research actually supports

- **Binkley et al., "To CamelCase or under_score" (ICPC 2009)** —
  eye-tracking study: camelCase identifiers were recognized with higher
  **accuracy** across all subjects regardless of training background,
  at slightly longer reading times
  (<https://www.computer.org/csdl/proceedings-article/icpc/2019/151900a177/1cYio9ioVws>;
  accessible analysis: <https://whatheco.de/2011/02/10/camelcase-vs-underscores-scientific-showdown/>).
  Practical read: the convention matters less than picking the codebase's
  existing one and never mixing — consistency beats either choice.
- Naming-quality effects on comprehension are among the better-supported
  readability findings, but effect sizes are modest; treat naming as
  high-leverage polish, not architecture.

## Calibrated practice for this repo

- New code you write: domain-intent names by default; the reviewer's test
  is "could a new maintainer say what this holds/does without reading its
  body?"
- Existing code you touch: fix names *inside the touched scope* when they
  actively mislead; renames of exported symbols are contract changes —
  record as follow-up (see `boy-scout-rule`'s gates).
- When a name and a comment would fight over the same job, spend on the
  name first; fall back to a comment only for what a name cannot carry
  (why-constraints, provenance).
