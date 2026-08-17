import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";

/**
 * Gives each Vitest file its own on-disk SQLite pair before application modules
 * are imported. Native SQLite module singletons then cannot leak fixtures or
 * transactions across parallel test files.
 */
const databaseDirectory = mkdtempSync(join(tmpdir(), "odyssey-vitest-"));
process.env.ODYSSEY_DB_PATH = join(databaseDirectory, "learning.db");
process.env.ODYSSEY_CURRICULUM_DB_PATH = join(
  databaseDirectory,
  "curriculum.db",
);

afterAll(() => {
  // Windows may retain a native SQLite handle until the worker exits. The
  // directory is OS-temporary either way, so teardown must not hide test data.
  try {
    rmSync(databaseDirectory, { force: true, recursive: true });
  } catch {
    // Best-effort cleanup only; the per-file path remains isolated.
  }
});
