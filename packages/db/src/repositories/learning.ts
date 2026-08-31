import type { DatabaseSync } from "node:sqlite";
import { migrateDatabase, openDatabase } from "../client";

/** Shared learning connection; the persistence owner configures and migrates it. */
export const learningDb = openDatabase("learning");

function hasColumn(
  database: DatabaseSync,
  table: string,
  column: string,
): boolean {
  return (
    database.prepare(`PRAGMA table_info(${table})`).all() as Array<{
      name: string;
    }>
  ).some((candidate) => candidate.name === column);
}

/** @deprecated Startup migrations are owned by the persistence module. */
export function migrateLastSubmissionOrdinal(database: DatabaseSync): boolean {
  const missing = !hasColumn(
    database,
    "test_sessions",
    "last_submission_ordinal",
  );
  migrateDatabase(database);
  return missing;
}

/** @deprecated Startup migrations are owned by the persistence module. */
export function migrateTestSessionStatusForPartial(
  database: DatabaseSync,
): boolean {
  const schema = database
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'test_sessions'",
    )
    .get() as { sql: string } | undefined;
  const requiresMigration = Boolean(
    schema && !/['"]partial['"]/i.test(schema.sql),
  );
  migrateDatabase(database);
  return requiresMigration;
}

/** Redacts legacy answer values without changing the current retention policy. */
export function redactLegacyAttemptAnswers(database: DatabaseSync): boolean {
  if (!hasColumn(database, "learning_attempts", "answer")) return false;
  database
    .prepare("UPDATE learning_attempts SET answer = ? WHERE answer <> ?")
    .run("[redacted]", "[redacted]");
  return true;
}

const hasLegacyRawAnswerColumn = hasColumn(
  learningDb,
  "learning_attempts",
  "answer",
);

/** Builds a parameterized write that never stores a child's raw answer. */
export function createLearningAttemptWrite(
  input: {
    childId: string;
    topicId: string;
    correct: boolean;
    levelBefore: number;
    levelAfter: number;
    createdAt: string;
  },
  legacyRawAnswerColumn = hasLegacyRawAnswerColumn,
): {
  sql: string;
  parameters: readonly (string | number)[];
} {
  const values = [
    input.childId,
    input.topicId,
    input.correct ? 1 : 0,
    input.levelBefore,
    input.levelAfter,
    input.createdAt,
  ] as const;
  if (legacyRawAnswerColumn)
    return {
      sql: `INSERT INTO learning_attempts
        (child_id, topic_id, answer, correct, level_before, level_after, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      parameters: [
        input.childId,
        input.topicId,
        "[redacted]",
        ...values.slice(2),
      ],
    };
  return {
    sql: `INSERT INTO learning_attempts
      (child_id, topic_id, correct, level_before, level_after, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`,
    parameters: values,
  };
}

export function withLearningTransaction<T>(work: () => T): T {
  learningDb.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    learningDb.exec("COMMIT");
    return result;
  } catch (error) {
    learningDb.exec("ROLLBACK");
    throw error;
  }
}
