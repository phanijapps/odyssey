import { expect, test } from "vitest";
import { DatabaseSync } from "node:sqlite";
import {
  createLearningAttemptWrite,
  learningDb,
  redactLegacyAttemptAnswers,
  withLearningTransaction,
} from "./sqlite-repository";

test("parameterizes attempt identity values without retaining raw answers", () => {
  const write = createLearningAttemptWrite(
    {
      childId: "child'; DROP TABLE learning_attempts; --",
      topicId: "ratio'); DELETE FROM learning_progress; --",
      correct: true,
      levelBefore: 1,
      levelAfter: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    true,
  );
  expect(write.sql).not.toContain("DROP TABLE");
  expect(write.sql).toContain("VALUES (?, ?, ?, ?, ?, ?, ?)");
  expect(write.parameters).toEqual([
    "child'; DROP TABLE learning_attempts; --",
    "ratio'); DELETE FROM learning_progress; --",
    "[redacted]",
    1,
    1,
    1,
    "2026-01-01T00:00:00.000Z",
  ]);
});

test("redacts historic raw answers from a legacy attempt schema", () => {
  const legacyDb = new DatabaseSync(":memory:");
  legacyDb.exec(
    "CREATE TABLE learning_attempts (answer TEXT NOT NULL, correct INTEGER NOT NULL)",
  );
  legacyDb
    .prepare("INSERT INTO learning_attempts (answer, correct) VALUES (?, ?)")
    .run("private child response", 1);

  expect(redactLegacyAttemptAnswers(legacyDb)).toBe(true);
  expect(redactLegacyAttemptAnswers(legacyDb)).toBe(true);
  expect(
    legacyDb.prepare("SELECT answer FROM learning_attempts").get(),
  ).toEqual({ answer: "[redacted]" });
  legacyDb.close();
});

test("rolls back repository work when the transaction fails", () => {
  const marker = "rollback-test";
  expect(() =>
    withLearningTransaction(() => {
      learningDb
        .prepare(
          "INSERT INTO learning_attempts (child_id, topic_id, correct, level_before, level_after, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(marker, "ratio", 1, 1, 1, new Date().toISOString());
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
