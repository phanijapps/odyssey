# Failure modes — how the rule goes wrong, with evidence

Every critique below is real and documented. None condemns the rule in its
bounded form; all of them condemn an unbounded reading of it. This file is
the reason the three gates exist — consult it when tempted to wave a hunk
through.

## 1. Scope creep

The most common objection. A representative LinkedIn critique (quoted in
Michał Lipek, "Boy scout rule bad?", 10 Jul 2024
<https://lipek.net/posts/2024-07-10-linkedin-boy-scout-rule-bad/>):

> "You end up with scope creep… You dramatically increase the likelihood of
> breaking that code… [refactoring] may make the code more complex."

The critic's summary line: "If ain't broke, don't break it." Lipek's
rebuttal — and this skill's position — is that the rule is sound but
routinely misapplied: improvements must be *intentional, incremental, and
aligned with the task*. That alignment is precisely what the
**same-concern** gate tests.

## 2. Review traceability loss

Coding Craftsman, "The Opposite of the Boy Scout Rule Is…?" (10 Jul 2024
<https://codingcraftsman.wordpress.com/2024/07/10/the-opposite-of-the-boy-scout-rule-is/>):
when cleanup swamps the feature, "the tiny feature in a huge sea of
refactoring can be hard to" review. The fix is not "don't clean" but
**traceability-preserving cleanup** — every hunk attributable to a named
intent. SKILL.md's *name every bundled cleanup* step operationalizes this,
and the **smaller** gate prevents the sea from forming.

## 3. Merge friction and churn risk

- Fowler names the merge cost directly: long-lived branches and strong code
  ownership make opportunistic refactoring expensive "because it makes
  merges more difficult"
  (<https://martinfowler.com/bliki/OpportunisticRefactoring.html>).
  Ride-along renames are the worst offenders — they touch every line a
  parallel branch might touch. Hence: renames of public symbols are always
  out of bounds; local renames only inside the touched scope.
- **What the churn research actually says** — Nagappan & Ball, "Use of
  Relative Code Churn Measures to Predict System Defect Density," ICSE
  2005 (<https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/icse05churn.pdf>,
  ~1,175 citations): relative code-churn measures strongly predict defect
  density (Windows Server 2003 case study). **Honest framing matters
  here**: the study links churn *magnitude* to defects; it does not study
  behavior-preserving cleanup specifically. It is evidence that *unbounded*
  change carries defect risk — a reason to bound cleanup, not to avoid it.
  Cite it that way or not at all.

## 4. The agent-specific failure mode

Agent-generated diffs changed the economics: the agent pays nothing to
"helpfully" improve adjacent code, and the human pays for all of it at
review. The strongest practitioner source on point — Slaptijack, "How To
Keep AI Coding Agent Changes Small Enough To Review"
(<https://slaptijack.com/articles/how-to-keep-ai-coding-agent-changes-small-enough-to-review.html>)
— is blunt:

> "'While I was here' is where small agent tasks go to become large
> reviews."

Its recommended defaults for agent work: "no opportunistic cleanup in the
first patch"; cleanup opportunities get *listed* under a "follow-ups"
heading instead of edited; "do not reformat unrelated code"; "do not rename
public symbols"; sequence genuinely-needed cleanup as separate commits or
PRs; set a diff budget up front; require a scope report of what changed and
what was deliberately left alone. Supporting context: Swarmia's autonomy
levels argue for small, focused, individually-verifiable changes per PR
(<https://www.swarmia.com/blog/five-levels-ai-agent-autonomy/>), and
CodeScene's agentic-coding guidance notes agents do best in healthy
codebases — which is the compounding argument *for* the ratchet, held in
tension with review cost
(<https://codescene.com/blog/agentic-ai-coding-best-practice-patterns-for-speed-with-quality>).

**How this skill resolves the tension.** The slaptijack default ("no
cleanup in the first patch") and the Martin/Fowler default ("always clean
as you go") are both right about the world they describe: humans with
resident context vs. agents whose output is human-verified at cost. This
skill takes the middle that the three gates define — gate-passing cleanups
ride along *and are named* (preserving traceability, keeping the ratchet
turning); everything else goes to the follow-ups list (preserving review
bandwidth). The gates are the port of Fowler's "know when to call it a
day" into a form an agent can apply deterministically.

## What was *not* found (do not claim it)

Research for this module found no formal "Boy Scout Rule considered
harmful" paper, no handbook-level adoption in Google SRE / Software
Engineering at Google beyond passing mention, and no official AI-vendor
guidance (Anthropic, Cursor) that explicitly encourages or bounds
"improve while you're here" behavior. Treat the blog-level and
practitioner sources above as the state of the art, and don't cite
vendor docs for this claim without fetching them.
