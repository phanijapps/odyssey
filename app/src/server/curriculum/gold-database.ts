import "server-only";
import type { DatabaseSync } from "node:sqlite";
import { openDatabase, resolveDatabasePath } from "../persistence/sqlite";

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
    return operation(database);
  } finally {
    database.close();
  }
}
