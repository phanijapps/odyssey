import "server-only";
import { DatabaseSync } from "node:sqlite";

export const learningDb = new DatabaseSync(
  process.env.ODYSSEY_DB_PATH ?? ":memory:",
);

learningDb.exec(`
CREATE TABLE IF NOT EXISTS learning_progress (
  child_id TEXT NOT NULL, topic_id TEXT NOT NULL, level INTEGER NOT NULL,
  correct_streak INTEGER NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (child_id, topic_id)
);
CREATE TABLE IF NOT EXISTS learning_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, child_id TEXT NOT NULL,
  topic_id TEXT NOT NULL, correct INTEGER NOT NULL,
  level_before INTEGER NOT NULL, level_after INTEGER NOT NULL,
  created_at TEXT NOT NULL
);`);

/** Redacts historical answer text from a pre-privacy local attempt schema. */
export function redactLegacyAttemptAnswers(database: DatabaseSync): boolean {
  const hasRawAnswerColumn = (
    database.prepare("PRAGMA table_info(learning_attempts)").all() as Array<{
      name: string;
    }>
  ).some((column) => column.name === "answer");
  if (!hasRawAnswerColumn) return false;
  database
    .prepare("UPDATE learning_attempts SET answer = ? WHERE answer <> ?")
    .run("[redacted]", "[redacted]");
  return true;
}

const hasLegacyRawAnswerColumn = redactLegacyAttemptAnswers(learningDb);

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
