# RFC-0004: Unify curriculum ontology and assessment catalog

- **Status:** Open
- **Date:** 2026-08-16

## Summary

Odyssey uses one reviewed curriculum ontology to identify what a learner studies
and is assessed on. Practice, Mistake-to-Mastery, Performance, and catalogued
assessments reference that ontology, but each keeps its own delivery and
measurement authority. The proposal avoids treating a curriculum standard as a
test item, form, provider score, or content-rights decision.

## Problem

Gold curriculum records are authoritative standards with provenance. The current
assessment flow correctly snapshots selected Gold records and keeps test results
separate from formative mastery, but it is a fixed local test, not a versioned
catalog. A future catalog needs blueprints, reviewed item revisions, rights
records, form revisions, administration policy, accommodations, and score-report
rules. Folding those into Gold or `assessmentTargets: string[]` would conflate
curriculum authority with delivery, content rights, and measurement claims.

## Decision

### Shared ontology

Gold remains the sole approved curriculum authority. It gains structured,
reviewed alignment metadata only when a real second consumer needs it:
concept tags, target categories, and explicit prerequisite relations. A
prerequisite relation is never inferred from standard-code ordering or a model.

Practice, Test Catalog forms, Performance, and Mistake-to-Mastery reference a
Gold record ID plus content fingerprint. They resolve their own behavior from
snapshotted revisions, so later curriculum edits cannot change a past attempt or
report.

### Separate assessment authorities

A catalog uses these immutable/revisioned authorities:

- **Test definition:** neutral title, jurisdiction/program metadata, relationship
  claim, lifecycle status, alignment claim, blueprint, administration policy,
  and scoring policy.
- **Item revision:** application-owned item ID/revision, interaction and
  accessibility data, answer key/rubric, Gold targets, review state, and
  mandatory content provenance/rights.
- **Form revision:** resolved ordered item revisions plus section, timing, tool,
  break, review, and feedback rules.
- **Administration:** learner-scoped, token-bound delivery snapshot and redacted
  response/outcome audit.
- **Score report:** raw/domain outcome plus scoring-policy revision. A provider
  scale, norm, growth, percentile, or proficiency result is absent unless an
  authorized, versioned conversion source explicitly provides it.

The present adaptive Practice state machine remains formative. A catalog
administration is never allowed to update Practice progress, adaptive level,
memory, or knowledge-graph beliefs merely because it targets the same Gold
record.

### Content and naming policy

Catalog v1 contains only original, reviewed, ontology-aligned practice forms.
It may describe a relationship such as `original-aligned` but does not claim an
official administration, provider endorsement, score equivalence, percentile,
growth metric, or proficiency result.

A named provider/program is display metadata, never a behavior switch. A source
rights record is required before any licensed/public-release material can be
transformed, sent to a model, persisted, or delivered. Ambiguous names such as
`ASAT` are unavailable until a steward records the exact program, jurisdiction,
release, permitted uses, and claim language.

### Performance and guidance

Performance is a learner-scoped, read-only projection of retained redacted
Practice and terminal Test evidence. It recomputes deterministic classifications
and child-safe guidance from authoritative SQLite records; it is not a second
mastery store and does not give Pi authority over facts, scope, actions, or UI.

A2UI v0.9.1 is the approved declarative presentation protocol for new dynamic
learning surfaces. Odyssey adopts the maintained React renderer
(`@a2ui/react` with `@a2ui/web_core`) and registers a small Odyssey catalog that
maps A2UI components to fixed accessible React components in the existing visual
language. The client owns rendering, styling, catalog capability, and action
dispatch; server-owned policy validates every envelope, component, binding,
data-model update, and action before it reaches the renderer or a mutation.

A2UI describes presentation, never educational authority. Assessment service
code chooses question type, assignment, answer validation, timing, and score.
Performance code chooses evidence, child scope, and action targets. Pi may
propose bounded insight prose only from a redacted evidence DTO; it never emits
trusted actions, chooses learner scope, changes scores, or bypasses A2UI/server
validation. V1 targets the stable v0.9.1 protocol, not the v1.0 Candidate.

## Consequences

- One ontology supports new educational surfaces without duplicated skill IDs or
  changing historic attempts.
- Item provenance, review, and rights are first-class gates rather than prompt
  text or labels.
- Original practice can ship without pretending to be a proprietary assessment.
- Parent/guardian sharing remains out of scope until a relationship/revocation
  model is separately approved; v1 Performance is learner self-view/admin demo.
- This RFC creates three dependent Draft specs: `mistake-to-mastery`,
  `performance-guidance`, and `test-catalog`.

## Alternatives considered

### Make Gold records into catalog items

Declined. Standards do not contain immutable item content, answer keys,
accessibility semantics, item rights, section placement, or scoring policy.

### Label current generated tests as named provider tests

Declined. A fixed local generated test cannot support official forms, proprietary
content, norming, calibrated adaptive selection, or provider score claims.

### Build a bespoke JSON view-document instead of A2UI

Declined. A2UI is an established declarative protocol with a stable React
renderer in v0.9.1 and provides the component/action/data-model lifecycle that
Performance, adaptive question interactions, and a future parent portal share.
Odyssey still constrains the catalog, transports, inputs, and authority rather
than accepting arbitrary model-generated UI.

### Create a reusable package immediately

Declined. The application is the only consumer. Contracts stay under
`app/src/server/curriculum/` until a second consumer requires a published
boundary.
