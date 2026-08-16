# Architecture

How the code is *currently* organized. Not why (that's in
[`../adr/`](../adr/)) and not what we want (that's in
[`../rfc/`](../rfc/)) — **what is**.

- [`overview.md`](overview.md) — the map of `app/`, `tools/`, project-owned
  agent configuration, and documentation. Read this first.
- [`reference.md`](reference.md) — the normative foundation for new
  implementation.
- [`application.md`](application.md) — runtime/data flow, module boundaries,
  and the public route-contract inventory.
- `<subsystem>.md` — add one for a non-trivial subsystem when its current
  structure needs more detail than the overview provides.

Architecture docs are the *rolled-up snapshot* — the answer to "what
does this codebase look like today" without replaying ADR history.
Lifecycle: living. Update whenever the layout or major dependencies
change.
