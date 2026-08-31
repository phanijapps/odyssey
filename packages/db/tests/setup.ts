import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";

/**
 * Gives each Vitest file its own on-disk SQLite pair before db modules are
 * imported (mirrors the web app's isolation setup).
 */
const directory = mkdtempSync(join(tmpdir(), "odyssey-db-vitest-"));
process.env.ODYSSEY_DB_PATH = join(directory, "learning.db");
process.env.ODYSSEY_CURRICULUM_DB_PATH = join(directory, "curriculum.db");
process.env.ODYSSEY_SEED_CATALOG = "0";

afterAll(() => {
  try {
    rmSync(directory, { force: true, recursive: true });
  } catch {
    // best-effort only
  }
});
