# SOLID — origins, definitions, calibrated use

## Origins (verified)

- The principles were assembled by **Robert C. Martin** in "Design
  Principles and Design Patterns" (2000) —
  <https://www.fil.univ-lille.fr/~routier/enseignement/licence/coo/cours/Principles_and_Patterns.pdf>.
- The **acronym** was coined ~2004, credited to **Michael Feathers**
  (<https://en.wikipedia.org/wiki/SOLID>;
  <https://stackoverflow.blog/2021/11/01/why-solid-principles-are-still-the-foundation-for-modern-software-architecture/>).
- Two members predate Martin: **OCP** originates with Bertrand Meyer
  (*Object-Oriented Software Construction*, 1988); **LSP** with Barbara
  Liskov's 1987 substitutability work. ISP and DIP are Martin's own.

## The five, in working form

| Principle | Working question at a real seam | Classic misapplication |
|---|---|---|
| **SRP** — Single Responsibility | Does this module have one reason to change / serve one actor? | Reading it as "one function per activity," producing shallow classes (Martin later reframed SRP around *actors*, not tasks) |
| **OCP** — Open/Closed | Can the next change extend behavior without editing stabilized code? | Speculative plugin plumbing for changes that never come |
| **LSP** — Liskov Substitution | Can any substitute be swapped in without surprising the caller? | Subclass that narrows a precondition or silently changes contract semantics |
| **ISP** — Interface Segregation | Does each consumer depend only on methods it uses? | One fat interface because "they're all related" |
| **DIP** — Dependency Inversion | Do high-level policies depend on abstractions, not concretions? | Injecting an interface with exactly one implementation and no seam pressure |

## Modern critiques (read before invoking SOLID in review)

- **dunnhq, "SOLID — is it still relevant?" (2021)**
  (<https://dunnhq.com/posts/2021/solid-relevance/>): argues the set is
  "just an ACRONYM" — five principles of uneven value bound together by
  memorability, not cohesion.
- **Florian Krämer (2025)**
  (<https://florian-kraemer.net/software-architecture/2025/02/24/Are-the-SOLID-Principles-problematic.html>):
  each principle is ambiguous enough to justify opposite designs; ISP/DIP
  especially generate ceremony.
- Community counterexamples thread:
  <https://softwareengineering.stackexchange.com/questions/447532/when-to-not-use-solid-principles>.
- Recurring theme: SOLID is **OOP-shaped** and fits functional /
  data-oriented code poorly; forcing ISP/DIP where there is one
  implementation and no second consumer is the standard cargo cult.

The defense worth reading: the Stack Overflow Blog piece above — SOLID as
the vocabulary of *module-boundary conversations*, which is the use this
skill endorses.

## Calibrated practice for this repo

1. **SRP as "one reason to change"** — this is the load-bearing principle
   for module and function boundaries, and it aligns with the repo's
   "each file one clear reason to change" review rule.
2. **Apply the others on evidence of pain, not in advance**: LSP when a
   substitute exists or is planned; ISP when a consumer visibly drags
   unused surface; DIP when a concretion's churn actually propagates;
   OCP when a second variant has arrived (matching the repo's flag rule:
   differ only when a second caller actually needs to).
3. **SOLID never overrides the evidence module's brakes** — a factory
   around one implementation satisfies DIP and still fails Beck's rule 4
   (minimize classes and methods) and the deep-module test.
