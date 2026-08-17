# Spec: Test Catalog

- **Status:** Implementing
- **Owner:** Product and Engineering
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** RFC-0004 (Accepted)
- **Brief:** none
- **Discovery:** local catalog/assessment and content-governance research, 2026-08-16
- **Contract:** catalog implementation defines steward and learner BFF contracts; the existing fixed Test remains supported pending parity evidence.
- **Shape:** mixed

## Objective

A Curriculum Steward creates and publishes reviewed, original,
ontology-aligned practice-test forms. V1 includes an original MAP-aligned local
practice form that is clearly not MAP Growth, an official MAP administration,
or a source of RIT/norm/growth results. Learners can discover and take a published
form under its frozen blueprint, timing, feedback, accessibility, and scoring
rules. The catalog makes every content-rights and relationship claim explicit,
keeps Test administrations isolated from Practice mastery, and never presents
local practice as an official AIR, MAP, ASAT, SAT, or other provider result.

## Boundaries

### Always do

- Reference approved Gold IDs/fingerprints for every aligned target and freeze
  catalog, form, item, policy, and target revisions at administration start.
- Require review state and a complete rights/provenance record before an item
  or form can be published or delivered.
- Keep catalog administration token-bound, learner-scoped, redacted, and fully
  separate from Practice progression/memory/graph state.
- Store and render accessibility/tool/timing/break rules as explicit,
  versioned, effective administration policy.
- Use the approved A2UI learning catalog for multiple-choice, true/false, and
  text-response presentation while retaining server-owned answer semantics.

### Ask first

- Any provider/program trademark, named test label, official-content claim,
  licensed/public-release content, external-result import, provider score,
  norm, percentile, growth, proficiency, or score prediction.
- An adaptive catalog administration, calculator/reference policy, novel
  response interaction, new accommodation, or background timer behavior.
- Retention changes for protected content, item keys, accommodation data, or
  imported reports.

### Never do

- Deliver an item with absent/expired/uncertain provenance rights, missing
  review, or a disallowed model-transform/delivery permission.
- Call original generated content an official test, official practice,
  provider-equivalent score, or branded administration.
- Feed protected items/keys/stimuli to Pi because they are Gold-aligned.
- Use catalog results to mutate Practice mastery, adaptive level, memory, or
  graph beliefs.
- Treat the ambiguous `ASAT` label as a publishable catalog relationship.

## Testing Strategy

- **TDD:** revision immutability, lifecycle transitions, rights gate,
  blueprint fulfillment, form freeze, timer/scoring state, and isolation rules.
- **Integration:** steward authorization/origin proof, catalog publish/delivery,
  item/form snapshot stability, learner scope, replay-safe answer delivery,
  policy/accommodation snapshot, redaction, and deletion/revocation behavior.
- **Visual/manual QA:** steward drafts/reviews/publishes a form; learner takes
  an untimed and timed original form using keyboard controls; review/report
  makes only allowed raw/domain claims.

## Acceptance Criteria

- [ ] Given an original item revision without reviewed provenance/rights, when a
      steward attempts publish or form inclusion, the operation fails closed with a
      steward-visible correction reason.
- [ ] Given a published original-aligned form, when a learner starts it, the
      administration freezes its form, item, Gold, blueprint, scoring, and
      accessibility-policy revisions and receives server-issued opaque assignments.
- [ ] Given a later edit/retirement/revocation, when an earlier administration
      is resumed or reviewed, it retains its authorized frozen snapshot; a new
      administration follows current publication/revocation policy.
- [ ] Given a catalog result, it returns only declared local raw/domain scoring
      and completion state; no provider norm, percentile, growth, proficiency,
      predicted score, or official-equivalence claim appears.
- [ ] Given any catalog administration result, Practice progress, adaptive
      level, memory, and knowledge-graph beliefs remain unchanged.
- [ ] Given a published item, its explicit interaction type is
      multiple-choice, true/false, or text-response; A2UI renders only the
      server-issued response schema and cannot expose a key or choose a type.
- [ ] Given a configured timed section, the learner sees the effective policy,
      allowed breaks/tools/review behavior, and a terminal reason that distinguishes
      completed, partial exit, expiry, and invalidity.
- [ ] Given an authorized accommodation policy, the administration snapshots
      only explicit supported configuration; unsupported accessibility claims are
      unavailable rather than silently labelled accommodated.
- [ ] Given a learner or anonymous caller, steward catalog draft/review/rights
      surfaces are inaccessible; given a learner, only published deliverable forms
      and their own redacted administrations are accessible.
- [ ] Given an original aligned form, every learner-facing label states its
      relationship and avoids protected provider branding/official claims.
- [ ] Given a retired/revoked item/form, it cannot be newly delivered; its
      historical report follows the retained authorized snapshot and redaction
      policy.

## Assumptions

- Technical: current Test sessions already provide learner-scoped persistence,
  snapshots, server-owned tokens, terminal review, and formative isolation
  (source: assessment service/spec).
- Technical: Gold is approved curriculum standard metadata, not a test-item or
  rights authority (source: curriculum model and promotion flow).
- Technical: A2UI v0.9.1 with an Odyssey allowlisted React catalog is the
  presentation contract for new question interactions (source:
  `a2ui-learning-delivery` Draft).
- Product: v1 stores only original reviewed ontology-aligned practice forms;
  named-test content/results are excluded (source: provisional research
  recommendation; requires approval before implementation).
- Product: v1 includes one original local MAP-aligned practice form but no MAP
  Growth/official-content/score/norm/growth/endorsement claim; AIR, SAT, and
  ASAT remain unavailable pending exact source/rights definitions (source: user
  confirmation 2026-08-16).
