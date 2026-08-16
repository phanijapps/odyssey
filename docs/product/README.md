# Product

> The product-side counterpart to [`architecture/`](../architecture/).
> Architecture answers "what is the code, today?"; product answers "what
> is the product, today?" Both are *living* docs — kept in sync with
> reality, not historical record.

## What lives here

- [`roadmap.md`](roadmap.md) — direction for the next 2-4 quarters.
  Direction, not commitments. Updated quarterly.
- [`changelog.md`](changelog.md) — user-visible changes by release,
  in [Keep a Changelog](https://keepachangelog.com/) format. Updated
  every PR that changes user-visible behavior.
- [`briefs/`](briefs/) — product brief(s) that constrain related specs.
- [`persona-mockups.html`](persona-mockups.html) — retained persona design
  artifact.

Add a persona document or release checklist only when it is actively used.

## What does NOT live here

- **Why we made past choices** → [`../adr/`](../adr/) (immutable history).
- **What we're proposing to change** → [`../rfc/`](../rfc/) (governance).
- **What an individual feature does** → [`../specs/<feature>/spec.md`](../specs/).
- **The mission and scope of the project** → [`../CHARTER.md`](../CHARTER.md).
- **How users actually use the product** → a future `docs/guides/` collection, when user documentation is needed.

## The product/ layer is *living*

Unlike ADRs and shipped specs (which are frozen records), files here must
match current reality. Drift is a bug. The maintenance rules are in
[`../CONVENTIONS.md`](../CONVENTIONS.md#document-lifecycle).
