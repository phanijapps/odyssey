# Tests — Ch. 9, F.I.R.S.T., and the TotT corpus

## The book's position

- "Dirty tests are worse than no tests." A suite that lies (stale
  expectations, order dependence, tests that can't fail) costs more than
  the absence of tests: it manufactures false confidence and trains the
  team to ignore red.
- **F.I.R.S.T.** — tests should be:
  - **F**ast (slow suites get skipped, and skipped suites protect
    nothing),
  - **I**ndependent (no test depends on another having run; any subset
    runs green),
  - **R**epeatable (same result in any environment, no clock/network/
    filesystem luck),
  - **S**elf-validating (pass/fail, not a log to eyeball),
  - **T**imely (written with, ideally just before, the production code).
- **Build-Operate-Check** structure: build the fixture, operate the
  system, assert the outcome — visible as three phases in the test body.
- One concept per test; minimize asserts per test; test names that
  document the behavior ("promotes at a streak of exactly four", not
  "testMastery4").

## The Google TotT corpus (testing.googleblog.com)

The Testging-on-the-Toilet archive carries the practice-grade versions
of these ideas — canonical entries worth citing by name:

- "Test Behaviors, Not Methods" — organize tests around observable
  behavior, not around mirroring the class's method list; method-shaped
  tests break on every refactor without telling you anything broke.
- "Writing Descriptive Test Names" (Trenk, 2014) — the name is the
  specification; a reader should predict the assertions from it.
- "Don't Mock Types You Don't Own" — wrap third-party types behind your
  boundary (see
  [errors-and-boundaries.md](errors-and-boundaries.md)) and mock your
  wrapper; mocking the foreign type pins its internals into your suite.

Archive root: <https://testing.googleblog.com/2007/10/>. Test-code
readability research building on this corpus: Springer EMSE 2024,
<https://link.springer.com/article/10.1007/s10664-023-10390-z>.

## TDD posture — and the debate about it

Martin's TDD "three laws" lock a ~30-second red-green-refactor cycle;
Ousterhout's counter-position (2025 debate,
<https://github.com/johnousterhout/aposd-vs-clean-code>) is "bundling" —
writing tens-to-hundreds of lines before testing, on the argument that
design thinking happens in larger units than a 30-second slot allows.
**This repo's rule** (via `work-loop`'s verification modes): TDD is the
default for compressible invariants (pure logic, state machines,
protocols); goal-based checks replace tests where a test would merely
re-assert what the compiler proves. The workflow question belongs to
`work-loop`; this skill governs the *quality* of whatever tests exist:
behaviors not methods, independent, honest names, minimal asserts.

## Reviewer's spot-list

- A test that cannot fail (asserts a constant, mocks the thing under
  test, or catches its own failure).
- Hidden ordering/time dependence (`Date.now()` without injection,
  shared mutable fixtures).
- Assertion storms — one test asserting ten unrelated things, so its
  failure localizes nothing.
- Names that mirror method names instead of stating behavior.
