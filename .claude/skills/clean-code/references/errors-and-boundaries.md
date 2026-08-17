# Errors and boundaries — Ch. 7–8

## Error handling (Ch. 7)

- **Prefer exceptions (or the codebase's typed-result idiom) to error
  codes.** Error codes force every caller up the chain to branch on them,
  scattering one policy across the call graph; a thrown/propagated error
  keeps the happy path readable and the failure policy in one place.
- **Extract try/catch bodies into their own functions** — a try block is
  a scope, and scoping is a function's job. `try { ...everything... }`
  wrapping a whole workflow hides which statement is guarded.
- **Don't return `null`** where an empty collection or a named case says
  it better (`noAttempts` instead of a null array); **don't pass `null`**
  as an argument — a parameter that may legitimately be null is two
  functions pretending to be one.
- **Give errors context**: the operation, the identifiers involved, the
  constraint violated. `Error("daily attempt limit reached")` beats
  `Error("limit")`; `Error("limit")` beats a silent `catch {}`. The
  silent swallow is the worst outcome — it looks like success.
- **Don't leak internals in messages** that cross a trust boundary —
  that's the overlap with OWASP secure-coding practice (error messages
  are an output surface; keep SQL fragments and paths out of
  user-facing text). Security depth lives in the `security-checklists`
  skill's `exceptional-conditions` module; this skill owns the
  maintainability half.

## Boundaries (Ch. 8)

- **Wrap third-party APIs behind your own interface.** The boundary
  adapter is where the foreign API's types, error model, and churn stop.
  Code that imports a third-party type deep in business logic has no
  boundary — every upstream release becomes a repo-wide change.
- **Learning tests**: when integrating an unfamiliar external library,
  a suite of small tests pinning its observed behavior for your use
  cases pays for itself — when the dependency upgrades, the tests say
  whether *your* assumptions survived.
- **Boundary conversion discipline** (this repo's rule, matching
  AGENTS.md): validate and convert untrusted input to typed data at the
  edge — parse, don't validate-and-pass-through — then trust internal
  callers. A `string` that reached three layers deep carrying "maybe an
  ISO date" is a boundary that wasn't held.

## Reviewer's spot-list

- Broad `catch (e) {}` / `catch { /* ignore */ }` — what failure is being
  hidden, and who will see it when it happens?
- Error messages that name the operation and its subject, or just noise?
- `null` returns where an empty collection / named case exists.
- Third-party types or raw `any` leaking past the module that owns the
  integration.
- Boolean-returning validators that silently drop *why* validation
  failed — the caller can't act, and the log can't explain.
