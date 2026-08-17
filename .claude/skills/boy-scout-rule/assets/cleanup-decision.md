# Cleanup decision tree — the three gates as a checklist

Portable form of SKILL.md's contract. Use it mid-task when you notice a
nearby defect and need a ruling, or paste the templates into your PR.

## Decision tree

```
You notice a defect near code you are already changing.
│
├─ Is it MECHANICAL? (no design decision; verifiable by inspection alone)
│    NO  → follow-up list                                    ✗
│    YES ↓
├─ Is it SAME-CONCERN? (same file, same reason-to-change as the request)
│    NO  → follow-up list                                    ✗
│    YES ↓
├─ Is it SMALLER than the requested change? (fewer lines, less risk)
│    NO  → follow-up list                                    ✗
│    YES ↓
├─ Do surrounding tests give "behavior unchanged" confidence?
│    NO  → only provably-inert cleanups (comments, confirmed-dead code)
│    YES ↓
└─ FIX IT — and name it in the commit/PR notes                ✓
```

The follow-up list is not failure. Fixing gate-passing cruft and *listing*
the rest is the whole skill; the ratchet turns on the first, the codebase
stops lying on the second.

## Worked rulings

| Noticed near the change | Ruling | Gate that decides |
|---|---|---|
| Comment describing behavior your change just altered | Fix + name | mechanical, same-concern |
| Unused import in the file you edited | Fix + name | mechanical |
| Dead branch your change made unreachable | Fix + name | mechanical (compiler/test confirms) |
| Misleading local variable name inside the function you touched | Fix + name | mechanical, same-concern |
| Misspelled identifier in an adjacent function you did not touch | Follow-up | not same-concern |
| `handleData()` export with a lying name | Follow-up | public contract → not mechanical |
| Three near-duplicate blocks you could extract | Follow-up | needs design → not mechanical |
| Formatting drift across the file | Follow-up (or run the formatter separately) | formatter's job |
| Missing input validation on the boundary you're editing | Fix if the change reveals it; else follow-up | boundary work belongs to the change |

## Templates

**Commit / PR description rider naming (required when bundling):**

```
Also bundled (boy-scout, mechanical/same-concern/smaller):
- removed unused `node:fs` import orphaned by this change
- updated the streak comment, which the fix falsified
```

**Follow-up note (the surplus you declined):**

```
Noticed, not touched (out of scope here):
- mastery.ts `oldComputeMasteryLevel` has no remaining callers — delete in a
  dedicated change
- session-report.ts buildParentReport is due for decomposition (needs design)
```

**Scope report (for agent-generated diffs, when reviewability matters):**

```
Changed: mastery.ts (promotion comparison, unused import)
Deliberately not changed: db.ts, export names, module structure
```
