# Smells and Heuristics — the verified catalog (Clean Code, Appendix C)

Ranges verified against the book's appendix; popular web lists renumber
them (one Medium list runs to "G70/F9"), so **cite by letter+number from
this table**, not from memory. Use it to name a finding precisely in
review — "G16 (obvious behavior unimplemented)" lands harder than "this
is weird."

## C1–C5 — Comments

| | Smell |
|---|---|
| C1 | Inappropriate information (changelogs, TODO archaeology in comments) |
| C2 | Obsolete comment |
| C3 | Redundant comment (narrates the code) |
| C4 | Poorly written comment |
| C5 | Commented-out code |

## E1–E2 — Environment

| | Smell |
|---|---|
| E1 | Build requires more than one step |
| E2 | Tests require more than one step |

## F1–F4 — Functions

| | Smell |
|---|---|
| F1 | Too many arguments |
| F2 | Output arguments |
| F3 | Flag arguments |
| F4 | Dead function |

## G1–G36 — General (the big list — reviewer's daily bread)

Highlights reviewers reach for most; full list in the appendix:

| | Smell |
|---|---|
| G1 | Multiple languages in one source file |
| G2 | Obvious behavior is unimplemented |
| G3 | Wrong behavior at the boundary (off-by-one, inclusive/exclusive) |
| G4 | Overridden safeties (warnings disabled, lint silenced) |
| G5 | Duplication |
| G6 | Code at wrong level of abstraction |
| G7 | Base classes depending on their derivatives |
| G9 | Dead code |
| G11 | Inconsistent spellings/casing of the same concept |
| G12 | Default behavior that silently does the wrong thing |
| G13 | Magic values |
| G14 | Fear of adding needed clarity vs G15 fear of removing |
| G16 | Obvious behavior unimplemented (nil/empty/edge case) |
| G17 | Duplicated code at switch/if chains |
| G18 | Incorrect boundary behavior |
| G21 | Misleading name |
| G22 | Ignored/overridden test |
| G23 | Divergent change (module changed for different reasons) |
| G24 | Shotgun surgery (one change scattered across many files) |
| G25 | Feature envy |
| G27 | Structure over convention… |
| G28 | Encapsulate boundary conditions |
| G30 | Magic numbers/strings (with G13) |
| G31 | Transitive navigation (Law of Demeter: `a.b().c().d()`) |
| G32–G36 | structure/naming/decision and responsibility refinements |

(The table above abbreviates; when precision matters — quoting a number
in a formal review — verify against the appendix itself. G-numbering
beyond the entries above is stable in the book but frequently garbled in
web copies.)

## J1–J3 — Java-adjacent (applies by analogy)

J1 wildcard imports · J2 don't inherit constants · J3 constants vs enums.

## N1–N7 — Names

N1 choose descriptive names · N2 names at the appropriate abstraction
level · N3 use standard nomenclature · N4 unambiguous names · N5 use
long names for long scopes · N6 names should describe side effects ·
N7 encode no type information the language carries.

## T1–T9 — Tests

T1 insufficient tests · T2 use a coverage tool · T3 don't skip trivial
tests · T4 an ignored test is a question about ambiguity · T5 test
boundary conditions · T6 exhaustively test near bugs · T7 patterns of
failure are revealing · T8 test-driven patterns of failure · T9 tests
should be fast.

## Review usage

Pair each finding with the *higher-order rule it violates* (abstraction
level, dead code, misleading name) rather than the smell number alone —
the number adds precision, the principle carries the argument. And
remember the catalog is a 2008 OOP-era instrument: file it under
"vocabulary for findings," not "law."
