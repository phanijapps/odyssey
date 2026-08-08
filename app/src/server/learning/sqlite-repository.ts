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
  topic_id TEXT NOT NULL, answer TEXT NOT NULL, correct INTEGER NOT NULL,
  level_before INTEGER NOT NULL, level_after INTEGER NOT NULL,
  created_at TEXT NOT NULL
);`);

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
