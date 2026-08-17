# Comments and formatting — Ch. 4–5, and the 2025 comments debate

## The book's dual position (Ch. 4, "Comments")

Both poles are genuine quotes from the same chapter:

> "Nothing can be quite so helpful as a well placed comment."

> "Comments are always failures." (…failures of the code to explain
> itself; the debate transcript quotes this formulation.)

Martin's acceptable-comment taxonomy: legal, informative, **intent**
(the why behind a decision), clarification (of unchangeable external
code), warning, TODO. His condemned set: narration, journal comments
("changed by / on / why" — that's version control's job), positional
markers, closing-brace markers, attributions, and **commented-out code**
(smell C5 — dead code that no one dares delete; version control remembers).

Ousterhout counted the book spending ~4 pages on good comments vs ~15 on
bad — a ratio that shapes how the advice gets applied in practice.

## The 2025 debate: comments as misinformation vs comments as design

Primary source: <https://github.com/johnousterhout/aposd-vs-clean-code>
(Sept 2024–Feb 2025 discussion; Reddit summary thread:
<https://www.reddit.com/r/programming/comments/1iwlgzq/>).

- **Martin:** "I look at every comment as potential misinformation."
  Comments rot independently of code; a wrong comment is worse than no
  comment; where possible, spend the effort on better names and smaller
  units instead. Hence long "megasyllabic" names over explanatory
  comments.
- **Ousterhout:** the missing-comments problem costs him "10–100×" more
  than wrong comments ever have; he reports spending 50–80% of
  development time deciphering insufficiently documented code. Comments
  that capture *why* — the decision, the constraint, the rejected
  alternative — are the highest-value text in a codebase, because that
  information exists nowhere else.
- Neither disputes the narration-ban; the disagreement is about the
  default posture toward comments that carry information code cannot.

**This skill's resolution:** the deciding question is *can this
information live in the code?* If yes (a better name, a narrower
function), put it there. If no — constraints, invariants, provenance,
rejected alternatives, magic numbers' sources — the comment is the right
home, and omitting it is a defect, not restraint. When your change
falsifies a comment, fixing the comment is part of the change.

## Formatting (Ch. 5)

The book's real points survive modern tooling mostly as *defaults the
formatter enforces*: vertical openness between concepts, related code
close together, team-consistent style. **Practical consequence for this
repo:** formatting is the formatter's job. Hand-restyling untouched lines
in a diff adds review noise and merge friction for zero information
gain; a review comment about formatting is a lint configuration missing,
not prose. Set the rule in tooling once, then never carry it in review
notes (see also the Stack Overflow guidance on shared guidelines for AI
agents — mechanics belong to linters/static analysis:
<https://stackoverflow.blog/2026/03/26/coding-guidelines-for-ai-agents-and-people-too/>).

## Examples for reviewers

**Earns its place** (information code can't carry):

```ts
// Product ruling 2026-01: cap at 8 per grade band so a slow device
// never renders more than one screen of results.
const MAX_PER_GRADE_BAND = 8;
```

```ts
// Not worth inlining: SQLite has no UPSERT in this schema version,
// so read-then-write is the sanctioned pattern despite the race window.
```

**Delete on sight** (narration the code already says):

```ts
// loop over the questions and add up the points
for (const q of questions) { total += q.points; }
```

```ts
// increment i
i++;
```
