import type { DatabaseSync } from "node:sqlite";
import { openDatabase, resolveDatabasePath } from "../client";
import { ensureCatalogSeeded } from "../catalog-seed";

/** Resolves the absolute configured Gold curriculum database path. */
export function resolveGoldDatabasePath(): string {
  return resolveDatabasePath("curriculum");
}

/** Opens the configured Gold database for an operation and closes it afterwards. */
export function withGoldDatabase<Result>(
  operation: (database: DatabaseSync) => Result,
): Result {
  const database = openDatabase("curriculum");
  try {
    // The reviewed JSON catalog is the curriculum source of record (RFC-0006
    // phase 3a); seeding is idempotent (hash-guarded single SELECT when
    // current) and can be disabled for tests that build exact fixtures.
    if (process.env.ODYSSEY_SEED_CATALOG !== "0") ensureCatalogSeeded(database);
    return operation(database);
  } finally {
    database.close();
  }
}
