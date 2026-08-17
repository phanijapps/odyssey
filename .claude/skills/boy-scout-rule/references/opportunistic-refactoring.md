# Opportunistic Refactoring — the theory behind the rule

Martin Fowler's writing is the most-cited theoretical grounding for
campground-style cleanup. Read this to understand *why* the gates in
SKILL.md are where they are.

## Fowler's position (primary sources)

**"Opportunistic Refactoring" bliki, 1 Nov 2011**
<https://martinfowler.com/bliki/OpportunisticRefactoring.html>

- Refactoring should be "an opportunistic activity, done whenever and
  wherever code needs to cleaned up — by whoever" sees the problem; fix it
  "right there and then."
- He explicitly frames it as the campsite rule: "always leave the code
  behind in a better state than you found it."
- **Bounds he names** (each maps to a gate or a calibration in SKILL.md):
  - Refactor "when your tests are green"; the practice "does depend on
    having a good regression suite." → SKILL.md's *calibrate to test
    coverage*.
  - "There is a genuine danger of going down a rabbit hole" — soon you're
    "deep in yak hair"; good judgment is knowing "when to call it a day."
    Interrupted cleanups should be returned to "the same day." → the
    *smaller* gate and the follow-up list bound the rabbit hole.
  - Merge friction: he is "wary of any development practices that cause
    friction" — strong code ownership and long-lived feature branches
    discourage opportunistic refactoring "because it makes merges more
    difficult." → the *same-concern* gate keeps the diff mergeable.

**The fuller taxonomy.** "Workflows of Refactoring" (8 Jan 2014)
<https://martinfowler.com/articles/workflowsOfRefactoring> and *Refactoring*
2nd ed. (2018) split opportunistic work into:

- **Litter pickup** — the small campsite-rule acts this skill governs.
- **Comprehension refactoring** — renaming/reshaping what you had to
  understand anyway, so the next reader inherits the understanding.
- **Preparatory refactoring** — making the change easy *before* making the
  change. Kent Beck's line, quoted by Fowler ("Preparatory Refactoring
  Example", 5 Jan 2015
  <https://martinfowler.com/articles/preparatory-refactoring-example.html>):
  "for each desired change, make the change easy (warning: this may be
  hard), then make the easy change."
- **Planned refactoring** — a scheduled effort on a gnarly lump. Fowler's
  position: a good team "should hardly ever need to plan refactoring," but
  the place for it exists.

**Reading the taxonomy against this skill:** litter pickup and comprehension
refactoring are what may ride along (through the gates); preparatory
refactoring is *part of the requested change* (shaping the seam you need is
in scope by definition, and `clean-code` governs its quality); planned
refactoring is explicitly out of this skill's scope — it is a work item,
not a rider.

## Where it sits in this repo's process

- `work-loop`'s **bundled-fixes carve-out** (same-area, same-concern,
  mechanical ride-alongs only; surplus to follow-up) is this skill's
  three gates expressed at process level. The skill is the depth behind
  the rule; neither overrides the other.
- The repo's **minimal-diff principle** ("code is a liability, not an
  asset") and this skill agree more than they first appear to: both treat
  unrequested changes as costs. The disagreement is only about *how small*
  a change must be before its cost is dominated by the good it does —
  which is exactly what the gates measure.
- Conventional Commits gives the mechanical hook for naming riders: keep
  `refactor:` / `chore:` hunks separate from `feat:` / `fix:` hunks when
  they exceed triviality
  (<https://www.conventionalcommits.org/en/v1.0.0/>).

## Why the skill is stricter for agents than Fowler is for humans

Fowler writes for a developer with resident context: you wrote the line,
you know the tests, you'll see the merge yourself. An agent meets the file
cold, cannot feel "green tests" except by running them, and — the decisive
difference — its output is verified by a human whose review bandwidth is
the scarcest resource in the loop. Every bundled hunk taxes that review.
The gates are therefore applied *to the letter* for agent work, and the
default for anything doubtful is list-don't-fix (see
[failure-modes.md](failure-modes.md) for the agent-specific evidence).
