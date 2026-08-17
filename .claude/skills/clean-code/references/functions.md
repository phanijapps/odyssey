# Functions — Ch. 3, the evidence, and the deep-modules counterpoint

This is the most contested territory in clean code. Read this before
imposing or accepting any function-size opinion in review.

## The book's position (Ch. 3, "Functions")

- "The first rule of functions is that they should be small. The second
  rule of functions is that they should be smaller than that." Ideal:
  2–4 lines; blocks of one line; indent level max two; zero arguments
  ideal, three is confusing.
- **One level of abstraction per function**; a program reads top-to-bottom
  like a narrative, each function descending exactly one level.
- The **extraction test**: break a function down "if you can extract
  another function from it with a name that is not merely a restatement
  of its implementation." (Verified via the Ousterhout–Martin debate
  materials and qntm's essay, which quote the book directly.)
- No side effects; command/query separation; no flag arguments;
  "duplication may be the root of all evil in software."

## What the book concedes, and what the studies say

Martin, in the book itself: "This is not an assertion that I can justify.
I can't provide any references to research that shows that very small
functions are better" (quoted in qntm's essay).

The defect-density literature (surveyed by Derek Jones, 2023,
<https://shape-of-code.com/2023/09/10/optimal-function-length-an-analysis-of-the-cited-data/>):

- **Basili & Perricone 1984** (90K LOC Fortran): errors/KLOC *fell* from
  16.0 for ≤50-LOC modules to 6.4 for >200-LOC modules.
- **Shen et al. 1985**: defects ≈ LOC^0.5 — defect count grows
  sublinearly with size.
- **Möller & Paulish 1993**: fault rates decreased with module size.
- **Withrow 1990** (Ada): the lone U-shape, optimum ~225 LOC — Jones
  calls the U a statistical artifact.
- **Code Complete 2nd ed. (2004, p. 523)**, citing Lind & Vairavan 1989:
  routines averaging **100–150 lines were changed least** during
  maintenance
  (<https://jmvidal.cse.sc.edu/library/mcconnell04a.pdf>;
  analysis: <https://dubroy.com/blog/method-length-are-short-methods-actually-worse/>).

**Honest framing:** these studies measure *defect density and change
frequency*, not comprehension, and predate modern tooling. The defensible
statement is: *no strong evidence favors very small functions; several
studies favor longer modules; decide by readability and abstraction
boundaries, not line counts.*

## The deep-modules counterpoint (Ousterhout, A Philosophy of Software Design, 2018)

A **deep module** provides much functionality behind a small interface;
a **shallow module** provides little behind an interface that costs as
much to learn as the functionality it hides. The tiny-function style
manufactures shallow methods and — the sharper charge — **entanglement**:
methods that must be read together because none can be understood alone.

The 2025 debate (primary: <https://github.com/johnousterhout/aposd-vs-clean-code>)
made this concrete on Martin's own Ch. 10 `PrimeGenerator`:

- Martin conceded on his own 8-method version ("I think you have a
  point" — he had struggled to modify it 18 years later).
- Ousterhout's counter-rewrite (one 65-line method) was judged by Martin
  better than his own book version.
- Martin's *second* counter-rewrite split one loop into two methods and
  suffered a **3–4× slowdown (5–10× more iterations)** that Ousterhout's
  benchmark caught; the final 4-method version restored performance
  (440 ms vs Ousterhout's 561 ms for 1M primes). Lesson extracted:
  decomposition is not free — splitting a fused loop can break the
  compiler's ability to keep hot data in registers, and micro-benchmarks
  notice.

qntm's related critique ("It's probably time to stop recommending Clean
Code", 2020, <https://qntm.org/clean>) documents the FitNesse Ch. 3
refactor producing 15 private methods, **13 of which had or relied on
side effects** — extraction without one-thing discipline just relocates
the complexity. A commenter benchmarked the book's Ch. 8 prime algorithm
at ~22 minutes for 20M primes vs ~45 s for a simple sieve.

## Calibrated practice

1. **Shape by abstraction level, not length.** One policy or state
   transition per function; SQL/policy/serialization don't share a body.
   Within that constraint, size is what it is.
2. **Apply the extraction test.** Extract only what earns a name that
   isn't a restatement of the body. `streakDecayDays(elapsedMs)` earns
   it; `processStepTwo()` doesn't.
3. **In existing code, the repo's second-caller rule governs** when to
   extract: a real second caller, or a security/transaction boundary
   needing a named seam. A single-use helper extracted "for clarity" can
   be worse than the inline original (Carmack's inlining rule of thumb:
   "If a function is only called in a single place, consider inlining
   it… The function that is least likely to cause a problem is one that
   doesn't exist" — secondhand citation, 2014).
4. **Mind hot paths.** In performance-relevant code, verify that a
   "clarity" split didn't break fusion — the debate's 3–4× regression is
   the cautionary tale.
5. **Complexity you can measure:** cyclomatic complexity (McCabe 1976)
   counts independent paths — a *testability* metric; SonarSource's
   **Cognitive Complexity** (Campbell whitepaper,
   <https://www.sonarsource.com/blog/cognitive-complexity-because-testability-understandability/>)
   measures *understandability*, penalizing nesting and non-linear flow.
   If you must gate on a number, gate on cognitive complexity, not LOC.
