# Technical debt

Evidence checked on 2026-09-07. This register separates defects repaired in the
question-atlas work from follow-up work requiring its own scope or content review.

## Repaired question flow

| Defect                                                   | Root cause                                                                                        | Repair                                                                                              | Verification                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Atlas branches never guided practice                     | Nodes were flattened and the tree walker had no production caller                                 | Persist atlas/walk state and consume answer outcomes atomically                                     | `atlas.test.ts`: first foundational node, sibling, deepen/widen, no extra completion calls |
| Duplicate and stale batches                              | Generation started before the winning pool write; completion checked topic only                   | Persist unique attempt identity before launch; require matching pending identity on completion      | Concurrent reads, A→B→A, expiry and logout regressions                                     |
| Initial uncovered skill was slow or failed while loading | Separate single-question generation preceded the batch; pending had no representation             | Bank-first claim or explicit pending batch, with one bounded request                                | Production browser receives pending then validated questions through the real SDK          |
| Completion and retry appeared broken                     | Completed/pending/failed pools all became a question error                                        | Distinct loading, failure and completion states; explicit restart, refreshed progress               | Browser completes 12 questions, recovers a failed round and renders at mobile width        |
| Invalid generated nodes reached practice                 | Cast-only parsing, field truncation and unsafe-diagram stripping                                  | Bounded unknown-data validation, independent node pruning, coverage checks and no answer truncation | 30 atlas-generator tests, including disabled integration and malformed envelopes           |
| Some catalog identities could not be answered            | Progress accepted composite topic identities longer than answer transport's 100-character ceiling | Both routes use the existing guidance ceiling of 300                                                | Reviewed long-topic route regression                                                       |
| Living architecture pointed to removed modules           | Multiple reorganizations left `apps/web`, `web` and `src/server` paths in current docs            | Reconcile README and the three architecture references with workspace manifests                     | Local link checks and current module/route inventory                                       |

Contract, boundaries and verification: [question-atlas-repair](../specs/question-atlas-repair/spec.md).
Detailed [verification evidence](../specs/question-atlas-repair/verification.md)
includes the configured live model accepting 12 questions through the built app.
Live checks also repaired unbounded streaming duration and a mismatch between
generated SVG quoting and the validator. Completion requests now use explicit
low reasoning effort and an overall abort deadline; failed batches emit redacted
diagnostics. A real-model browser round completed 14 distinct assignments.
Reproductions showed 213 original tests passing before new tests exposed these defects.
The current deterministic suite has 262 tests; lint, typecheck and production build pass.

## Open follow-up debt

| Finding                                            | Evidence                                                                                                                                            | Priority | Disposition                                                                                                                 |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| Vulnerable transitive dependencies                 | `pnpm audit --audit-level high`: four high findings in `fast-uri`, two moderate in `qs`; lockfile unchanged by this repair                          | High     | Separate lockfile/dependency remediation and compatibility verification; no claim that this repair removes these advisories |
| Reviewed bank coverage and precision               | `adaptive-pool.ts` uses broad keyword matches, picks one bank family, and repeats entries after candidates run out                                  | High     | Curated standard-to-question mapping, content review and coverage audit; atlas nodes themselves do not repeat               |
| Governance files contradict current implementation | RFC-0009 remains Draft although prior commits implemented it; root/nested AGENTS still contain obsolete layout/boundary descriptions                | Medium   | Reconcile through required governance process; repair spec records current work without inventing historical approval       |
| Environment template describes the wrong data root | `webapp/.env.example` describes database defaults relative to the package; database client resolves repository-root `data/`                         | Low      | Separate tightly local template correction; README/runtime references now identify the actual location                      |
| Existing browser suites bypass the catalog seeder  | Default parent/performance suites seed raw SQL and disable catalog seeding                                                                          | Medium   | Existing workspace backlog item `rfc0006-e2e-seeder-migration`; new atlas browser suite uses the real catalog seeder        |
| Obsolete question-prefetch API remains exported    | `prefetchNextQuestion` remains in core although the answer route no longer uses it                                                                  | Low      | Check external/internal callers before removing the export; dead statements in the touched answer route were removed        |
| Optional model availability is not guaranteed      | Real model resources, latency and generated mathematical correctness vary; deterministic transport verification does not certify every model answer | Medium   | Keep bounded fallback/retry behavior; evaluate representative generated curriculum independently                            |

## Dependency audit details

Audit exit status: 1; counts: four high, two moderate, zero critical. This is an
existing dependency finding, not a green security scan or a proven exploit in the
local question path. No dependency or lockfile was changed in this work.

- `fast-uri`: [IDN host confusion](https://github.com/advisories/GHSA-5jgf-p345-68v8),
  [IPv6 normalization](https://github.com/advisories/GHSA-f65p-4m7j-42xc),
  [repeated hostname decoding](https://github.com/advisories/GHSA-fph4-wmhf-6fwf),
  [scheme normalization](https://github.com/advisories/GHSA-jqff-g426-hqxp).
- `qs`: [array-limit bypass](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx),
  [isBuffer denial of service](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g).

Persistent atlas caching, replay and branch regeneration remain separate product
ideas described in RFC-0009, not unfinished portions of the question-flow repair.
