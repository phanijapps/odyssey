# Data directory

All runtime SQLite state lives here and is **git-ignored** — this
directory never enters version control (only this README and `.gitkeep`
are committed).

| File                    | What it is                                                                 | Owned by                                                                      |
| ----------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `odyssey-learning.db`   | Accounts, sessions, practice progress, attempts, assessments, parent links | `src/server/persistence/sqlite.ts` (default; override with `ODYSSEY_DB_PATH`) |
| `odyssey-curriculum.db` | Reviewed curriculum catalog (seeded from the versioned JSON at first open) | same (override with `ODYSSEY_CURRICULUM_DB_PATH`)                             |
| `e2e/`                  | Transient Playwright databases, reset every e2e run                        | `playwright.config.ts` + `e2e/global-setup.ts`                                |

Both databases run in WAL mode with foreign keys enforced. Back up a
database by copying it while the app is stopped (or use the admin
console's backup once RFC-0006 phase 8 lands). The learning database is
the one that matters — it holds every learner's history.
