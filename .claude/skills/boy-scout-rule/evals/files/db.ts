import "server-only";
import { DatabaseSync } from "node:sqlite";

export const learningDb = new DatabaseSync(
  process.env.ODYSSEY_DB_PATH ?? "odyssey-learning.db",
);
