import { afterEach, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { resolveGoldDatabasePath, withGoldDatabase } from "./gold-database";

const originalPath = process.env.ODYSSEY_CURRICULUM_DB_PATH;

function restoreCurriculumDatabasePath(): void {
  if (originalPath === undefined) delete process.env.ODYSSEY_CURRICULUM_DB_PATH;
  else process.env.ODYSSEY_CURRICULUM_DB_PATH = originalPath;
}

afterEach(() => {
  restoreCurriculumDatabasePath();
});

test("resolves the configured Gold database path or the existing fallback", () => {
  process.env.ODYSSEY_CURRICULUM_DB_PATH = resolve("configured-curriculum.db");
  expect(resolveGoldDatabasePath()).toBe(resolve("configured-curriculum.db"));

  delete process.env.ODYSSEY_CURRICULUM_DB_PATH;
  expect(resolveGoldDatabasePath()).toBe(resolve("odyssey-curriculum.db"));
});

test("closes the Gold database after successful and failed operations", () => {
  const directory = mkdtempSync(join(tmpdir(), "odyssey-gold-database-"));
  process.env.ODYSSEY_CURRICULUM_DB_PATH = join(directory, "curriculum.db");
  let successfulDatabase: DatabaseSync | undefined;
  let failedDatabase: DatabaseSync | undefined;

  try {
    expect(
      withGoldDatabase((database) => {
        successfulDatabase = database;
        database.exec("CREATE TABLE records (id INTEGER)");
        return database.prepare("SELECT 1 AS value").get();
      }),
    ).toEqual({ value: 1 });
    expect(() => successfulDatabase?.prepare("SELECT 1")).toThrow(
      "database is not open",
    );

    expect(() =>
      withGoldDatabase((database) => {
        failedDatabase = database;
        throw new Error("operation failed");
      }),
    ).toThrow("operation failed");
    expect(() => failedDatabase?.prepare("SELECT 1")).toThrow(
      "database is not open",
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});
