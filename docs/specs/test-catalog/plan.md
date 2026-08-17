# Plan: Test Catalog

- **Spec:** [`spec.md`](spec.md)
- **Status:** Executing

## Approach

Introduce a small explicit catalog domain beside—not inside—Gold curriculum and
current Test sessions. The first vertical slice is an original reviewed practice
form: steward creates immutable revisions and approves rights, publishes a
blueprint-complete form, learner administers a token-bound frozen form, and
receives a local raw/domain report. Reuse current assessment lifecycle patterns
only where the policy is identical; do not mutate it into a catalog god module.

## Constraints

- RFC-0004 is accepted; catalog implementation must retain its original-only, reviewed-rights and local-claim boundaries.
- The existing fixed mixed-skill Test stays supported until catalog parity and
  migration/deprecation are explicitly approved.
- No provider content, score mapping, trademark claim, or external integration
  enters v1.
- A new package is prohibited until a second consumer demonstrates need.

## Construction tests

**Integration tests:** full steward draft→review→publish→retire/revoke flow;
learner discover→start→answer replay→terminal report; role/origin isolation;
revision snapshots; no Practice mutation; content-rights denial; effective
policy/accommodation boundary; report redaction.

**Manual verification:** keyboard-only steward publishing and learner
administration for an untimed original form and a timed-section fixture;
observe policy, break, partial-exit, completion, review, and report language.

## Design (LLD)

### Data & schema

Use versioned immutable rows, with stable IDs plus revision IDs:

- `test_catalog_entries` / revisions: lifecycle and neutral relationship claim.
- `assessment_item_revisions`: reviewed content/interaction/rubric/targets and
  provenance/rights revision.
- `test_form_revisions`: resolved ordered item revisions, section blueprint,
  administration/scoring policy revision, and publication state.
- `catalog_administrations` / delivered items: learner snapshot, assignment
  token hash, redacted outcome audit, state/timing/terminal reason.
- `score_report_revisions`: raw/domain local results and validity wording.

Rights contain origin, rights-holder, locator/version/fingerprint, allowed
uses (display/transform/derivative/delivery/retention), expiry/revocation, and
steward approval. Protected item payload/key storage remains a future
source-specific design. Foreign keys, checks, and migration tests enforce
revision and state coherence.

### Interfaces & contracts

Separate route families expose (1) steward draft/review/publish/revoke forms,
items, and rights; (2) learner published catalog discovery; (3) learner
administration start/state/answer/exit/report. Contracts state roles, origin
rules, rate/size limits, request schemas, cache headers, redaction, and error
shapes before handlers exist. No client chooses item keys, form revision,
scoring, learner ID, or accommodation setting.

### Component / module decomposition

- `server/curriculum/catalog-*`: definition/form/item/rights revision
  repositories and publication validator.
- `server/learning/catalog-administration-*`: delivery state machine, timing,
  token consumption, scoring/report read model.
- steward catalog UI: narrow form/item/policy/review workflows.
- learner catalog UI: discover, policy preview, section runner, terminal review,
  report. Reuse existing test controls only after policy-level equivalence.

### State & control flow

Draft → reviewed → published → retired/revoked applies to entries/forms/items.
Start resolves only a published compatible form and freezes all revisions.
Each delivered item has one opaque assignment token and terminal state. A
revocation blocks new starts; historical handling uses explicit rights/retention
policy. Timers are server-authoritative with a monotonic deadline; the client
is display-only.

### Behavior & rules

Blueprint fulfillment is a deterministic validator: every required target,
section quota, item type, review state, right, and policy capability must be
satisfied before publication. Original-aligned labels are generated from a
closed relationship enum. Raw earned/possible and domain subtotals are the only
v1 score outputs. Unsupported accommodations/features appear unavailable.

### Failure, edge cases & resilience

Invalid/revoked content fails closed. Token replay is a no-op. Start races obey
one active administration policy per learner/form as explicitly configured.
Timer/client clock disagreement favors server time. Network recovery reloads
server state. A missing historical item does not leak a key; report displays
permitted aggregate outcome only.

### Quality attributes (NFRs)

Cap form size/items/assets and steward payload sizes before parsing. Parameterize
all data access. Preserve keyboard navigation/focus, semantic section landmarks,
accessible stimulus alternatives, and policy visibility. Audit only metadata and
redacted outcomes; never log item key/content in user-visible errors.

## Tasks

### T1: Approve catalog vocabulary, rights gate, and v1 claims

**Depends on:** none

**Tests:** no stub (policy/RFC approval); fixtures distinguish original-aligned,
licensed-official-content, and imported-result-reference, with only the first
allowed in v1.

**Approach:** settle relationship labels, source-rights fields, retention,
reviewer authority, original-item attestation, form lifecycle, local score
wording, and named-test exclusions.

### T2: Define and test immutable catalog revisions and publication validation

**Depends on:** T1

**Touches:** `app/src/server/curriculum/catalog-*`, persistence migrations

**Tests:** TDD state-machine/revision/rights/blueprint/target/provenance cases;
concurrent publish/revoke and migration integrity tests.

**Approach:** add focused repositories and validators; retain Gold as target
reference only.

### T3: Create steward-only catalog contracts and review workflow

**Depends on:** T2

**Touches:** steward routes/UI, contracts, curriculum services

**Tests:** authorization/origin/body-schema/lifecycle/rights failure tests and
manual keyboard review workflow.

**Approach:** deliver draft/review/publish/retire/revoke with explicit reasons;
no free-text provider claim or model authority.

### T4: Build learner catalog discovery and frozen A2UI administration

**Depends on:** T2, T3, `spec:a2ui-learning-delivery/T4`

**Touches:** learner routes/UI, `server/learning/catalog-administration-*`

**Tests:** published-only discovery, snapshot freeze, opaque token replay,
resume/exit/timer/section/break/tool policy, and learner isolation.

**Approach:** reuse current assessment token/terminal patterns where identical;
render only server-issued multiple-choice, true/false, and text-response schemas
through the A2UI catalog; otherwise keep catalog state machine separate and named.

### T5: Produce local reports and accessibility-policy evidence

**Depends on:** T4

**Tests:** raw/domain scoring/report redaction/no-official-claim/no-Practice-
mutation; policy snapshot and unsupported-accommodation tests; manual
keyboard/screen-reader-oriented review.

**Approach:** add report projection and explicit policy UI; avoid scale/norm
logic and score prediction.

### T6: Decide fixed-Test coexistence/migration after parity proof

**Depends on:** T4, T5

**Tests:** compatibility regression for current Test API/UI/history and catalog
coexistence; migration/deprecation tests only after explicit approval.

**Approach:** keep the existing fixed Test unchanged in v1 unless a later
approved decision maps it to a catalog form.

## Risks

- Rights metadata can become ceremonial; publish validation must require it.
- Catalog breadth can trigger a rewrite; ship original fixed forms before
  adaptive/licensed/imported modes.
- Accessibility labels can exceed capability; enumerate only implemented
  configurations and test each.
- A provider name can imply endorsement; generate only closed, reviewed labels.

## Changelog

- 2026-08-16: Drafted from catalog architecture and content-governance research.
