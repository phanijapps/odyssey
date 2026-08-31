# Data directory

All runtime SQLite state lives here and is **git-ignored** — only this
README and `.gitkeep` are committed.

| File                    | What it is                                                                 | Owned by                                                      |
| ----------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `odyssey-learning.db`   | Accounts, sessions, practice progress, attempts, assessments, parent links | `packages/db/src/client.ts` (override with `ODYSSEY_DB_PATH`) |
| `odyssey-curriculum.db` | Reviewed curriculum catalog (seeded from the versioned JSON at first open) | same (override with `ODYSSEY_CURRICULUM_DB_PATH`)             |
| `backups/`              | One-tap admin snapshots (`VACUUM INTO`)                                    | `webapp/app/api/admin/backup`                                 |
| `e2e/`                  | Transient Playwright databases, reset every e2e run                        | `webapp/playwright`                                           |

Both databases run in WAL mode with foreign keys enforced. Back up by
copying while the app is stopped, or use the admin console backup. The
learning database is the one that matters — it holds every learner's
history.
