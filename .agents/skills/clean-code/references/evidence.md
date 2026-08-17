# Evidence — what's supported, what's contested, what to read next

Read this **before** writing "research shows…" in any review note. Clean
Code's reputation and its evidence base are different things; conflating
them is how bad review comments get made.

## Contested: function length (the big one)

- The book's strongest stylistic claim (very small functions) carries
  the book's own admission: Martin writes he "can't provide any
  references to research that shows that very small functions are
  better."
- The defect-density literature surveyed by Derek Jones (2023,
  <https://shape-of-code.com/2023/09/10/optimal-function-length-an-analysis-of-the-cited-data/>)
  leans *against* tiny modules: Basili & Perricone 1984 (errors/KLOC
  16.0 → 6.4 as modules grow past 50 → 200+ LOC), Shen et al. 1985
  (defects ≈ LOC^0.5), Möller & Paulish 1993; only Withrow 1990 shows a
  U-shape (~225 LOC optimum), and Jones attributes the U to statistical
  artifact. Code Complete 2 (2004, p. 523) reports Lind & Vairavan
  1989: 100–150-line routines were *changed least* in maintenance.
- **Caveats that keep this honest:** those studies measure defect
  density and change frequency, not comprehension; they predate modern
  tooling and largely predate OO. The fair summary: *no strong evidence
  either way on length; abstraction discipline and naming are the
  defensible levers; never gate review on a line count.*

## Contested: the decomposition style itself

- **qntm, "It's probably time to stop recommending Clean Code" (2020)**
  <https://qntm.org/clean> — the canonical critique: the book's own
  worked refactors (Ch. 3 FitNesse `SetupTeardownIncluder`, Ch. 8 prime
  generator) produce side-effect-laden method webs (15 private methods,
  13 touching shared state) and a prime algorithm benchmarked by a
  commenter at ~22 minutes per 20M primes vs ~45 s for a plain sieve.
  Note the title is **qntm's**, not Ousterhout's — a common
  misattribution. qntm endorses APOSD as the replacement
  recommendation.
- **Ousterhout–Martin debate (Sept 2024–Feb 2025)**
  <https://github.com/johnousterhout/aposd-vs-clean-code> — primary
  transcript. Martin conceded his own Ch. 10 `PrimeGenerator` example
  ("I think you have a point"); Ousterhout's single-method rewrite was
  judged by Martin better than the book's; Martin's loop-splitting
  counter-rewrite cost 3–4× performance until corrected; final positions
  on comments ("every comment is potential misinformation" vs "missing
  comments cost 10–100× more than wrong ones") and TDD (30-second cycle
  vs bundling) both remain live.
- **A Philosophy of Software Design** (Ousterhout 2018; 2nd ed 2021) —
  deep vs shallow modules; the strongest coherent alternative frame.

## Better-supported territory

- **Naming and readability:** Binkley et al. ICPC 2009 eye-tracking
  (camelCase: higher recognition accuracy, slightly slower reading) —
  <https://whatheco.de/2011/02/10/camelcase-vs-underscores-scientific-showdown/>.
  Modest effects; consistency dominates choice.
- **Complexity metrics:** cyclomatic complexity (McCabe 1976, "A
  Complexity Measure") measures testability; SonarSource **Cognitive
  Complexity** (Campbell)
  <https://www.sonarsource.com/blog/cognitive-complexity-because-testability-understandability/>
  measures understandability — gate on the latter if you gate at all.
- **Test hygiene:** the Google TotT corpus and the Springer EMSE 2024
  test-readability literature (see
  [tests.md](tests.md)) carry practice-grade, low-controversy guidance.
- **SOLID:** lineage is documented (Martin 2000 paper; Feathers acronym;
  Meyer/Liskov priors) but the principles' *efficacy* is argued, not
  measured — see [solid.md](solid.md)'s critique list.

## The AI-agent angle (young, cite carefully)

- **Stack Overflow Blog, "Building shared coding guidelines for AI (and
  people too)" (2026)** —
  <https://stackoverflow.blog/2026/03/26/coding-guidelines-for-ai-agents-and-people-too/>:
  guidelines aimed at agents must be explicit and pattern-demonstrative
  (no tacit knowledge), include correct *and* incorrect examples plus a
  gold-standard file, be tested against bad-faith readings, and
  **defer mechanics to linters/formatters/static analysis**. This skill
  follows that template (operative rules + worked examples in
  references; mechanics excluded).
- Anthropic's engineering corpus relevant to agent-written code:
  Claude Code best practices (explore-plan-code-commit; small diffs;
  verify via tests/lint), effective context engineering, writing
  effective tools for agents —
  <https://www.anthropic.com/engineering>. **No Anthropic post titled
  "writing code for AI maintainers" exists**; don't cite one.
- Skeptical counterpoint worth holding: Peter Roelants's gist
  (<https://gist.github.com/peterroelants/69029d4100a99e22dbb7df60a14c286b>)
  doubts "agent-friendly structure" measurably reduces defects.

## Reading list (canonical order)

1. *Clean Code* (Martin, 2008) — a 2nd edition is reportedly in progress
   incorporating debate feedback (secondhand claim; unverified).
2. *A Philosophy of Software Design* (Ousterhout, 2018/2021) + the
   debate repo above.
3. *Code Complete* 2nd ed (McConnell, 2004) — the evidence-first
   classic.
4. *Refactoring* 2nd ed (Fowler, 2018) + refactoring.com — the catalog
   and the workflow taxonomy (also feeds `boy-scout-rule`).
5. cleancoder.com — Martin's blog.
6. Google TotT archive; SonarSource Cognitive Complexity whitepaper;
   Binkley et al. 2009.
7. Derek Jones's shape-of-code analyses for the function-length data.

## House rules for citing in review

- Quote the book by chapter, the debate by the transcript, the studies
  by author-year — never "studies show" unqualified.
- Distinguish *contested* claims (function length, comments posture,
  TDD cadence) from *settled* ones (narration comments are noise,
  swallowed errors are defects, dead code gets deleted).
- When two sources disagree (Martin vs Ousterhout on comments), present
  the disagreement and the deciding question — don't pick silently.
