# Clean-code diff review checklist

Run this over a diff before declaring done (self-review) or when
reviewing someone else's change. Read the diff as a **new maintainer**:
no context, no memory of the conversation that produced it.

## Names

- [ ] Every new identifier says what it holds/does — no `data`, `temp`,
      `info`, `flag`, `x` introduced by this change.
- [ ] Booleans read as predicates (`isExportable`, not `ok`).
- [ ] The change didn't introduce a second word for an existing concept
      (a new `fetch` beside an established `get`).

## Functions

- [ ] Each touched function does one policy or state transition; SQL,
      business rules, and serialization don't share a body.
- [ ] Any extraction passes the test: its name is not a restatement of
      its implementation.
- [ ] No boolean flag parameter switching behavior inside one function.
- [ ] Commands (mutate) are separate from queries (answer).
- [ ] No extraction performed solely for length; in existing code,
      extraction had a real second caller or a named boundary seam.
- [ ] Performance-relevant paths: a "clarity" split didn't break fusion
      (the debate's 3–4× regression is the cautionary tale).

## Comments

- [ ] Every comment in the diff carries what code can't: a constraint,
      a decision, an invariant, provenance.
- [ ] No narration ("// loop over rows"), no journal comments, no
      commented-out code.
- [ ] Comments the change falsified were fixed in the same change.
- [ ] Magic numbers carry their source ("8 per grade band — product
      ruling").

## Errors and boundaries

- [ ] No new broad/silent catch; failures surface with context
      (operation, subject, constraint).
- [ ] No new `null` return where an empty collection or named case
      says it better.
- [ ] Untrusted input is converted to typed data at the boundary; no
      raw strings/`any` carried inward.
- [ ] Third-party types don't leak past the owning module.

## Structure and scope

- [ ] Each file in the diff has one clear reason to change.
- [ ] Each public/exported symbol has an evident caller and contract.
- [ ] Code the change made unreachable (branches, imports, helpers) is
      deleted.
- [ ] Every hunk is attributable to the request, or is a named
      gate-passing rider (boy-scout-rule), or is removed.
- [ ] No speculative abstraction: no interface with one implementation
      and no second consumer, no configurability nobody asked for.

## Tests (if the change touches tests)

- [ ] Tests assert behaviors, not method mirrors.
- [ ] One concept per test; honest, predictive names.
- [ ] No test that cannot fail; no hidden time/order dependence.

## Output format

Report findings severity-ranked — 🟥 blocker / 🟧 major / 🟨 minor /
⚪ advisory — each anchored `file:line`, each naming the principle (and
smell code, where it sharpens) rather than a bare preference. Do not
file anything a linter or formatter should own.
