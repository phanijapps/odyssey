import { expect, test } from "vitest";
import { learningDb, withLearningTransaction } from "./sqlite-repository";

test("rolls back repository work when the transaction fails", () => {
  const marker = "rollback-test";
  expect(() =>
    withLearningTransaction(() => {
      learningDb
        .prepare(
          "INSERT INTO learning_attempts (child_id, topic_id, answer, correct, level_before, level_after, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .run(marker, "ratio", "2", 1, 1, 1, new Date().toISOString());
      throw new Error("forced failure");
    }),
  ).toThrow("forced failure");
  const row = learningDb
    .prepare(
      "SELECT COUNT(*) AS count FROM learning_attempts WHERE child_id = ?",
    )
    .get(marker) as { count: number };
  expect(row.count).toBe(0);
});
