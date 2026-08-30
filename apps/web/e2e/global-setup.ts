import { rmSync } from "node:fs";
import { join } from "node:path";

/**
 * Resets the isolated Playwright databases once per run, in the window
 * between web-server start and the first request — the server opens the
 * database lazily, so per-spec hooks would unlink it mid-run for whichever
 * spec file is still executing against the shared server.
 *
 * Breaking invariant: this only holds while the server opens its databases
 * lazily on the first request — an instrumentation hook or DB-touching
 * server component on the home route would split the server onto the
 * unlinked inode. Do not add one without revisiting this reset.
 */
export default function globalSetup(): void {
  for (const base of [
    join(process.cwd(), "data", "e2e", ".playwright-parent.db"),
    join(process.cwd(), "data", "e2e", ".playwright-curriculum.db"),
  ])
    for (const suffix of ["", "-shm", "-wal"])
      rmSync(`${base}${suffix}`, { force: true });
}
