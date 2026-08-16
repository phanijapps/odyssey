import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { DatabaseSync } from "node:sqlite";
import {
  createLearningAttemptWrite,
  learningDb,
  migrateLastSubmissionOrdinal,
  migrateTestSessionStatusForPartial,
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

test("serializes ordinal migration across two legacy database connections", () => {
  const directory = mkdtempSync(join(tmpdir(), "odyssey-legacy-"));
  const path = join(directory, "learning.db");
  const legacy = new DatabaseSync(path);
  legacy.exec(`
    CREATE TABLE test_sessions (
      id TEXT PRIMARY KEY, learner_id TEXT NOT NULL, subject TEXT NOT NULL,
      grade TEXT NOT NULL, status TEXT NOT NULL, score INTEGER NOT NULL,
      last_submission_hash TEXT, created_at TEXT NOT NULL, completed_at TEXT
    )
  `);
  legacy.close();

  const firstConnection = new DatabaseSync(path);
  const secondConnection = new DatabaseSync(path);
  try {
    expect(migrateLastSubmissionOrdinal(firstConnection)).toBe(true);
    expect(migrateLastSubmissionOrdinal(secondConnection)).toBe(false);
    expect(
      (
        secondConnection
          .prepare("PRAGMA table_info(test_sessions)")
          .all() as Array<{
          name: string;
        }>
      ).some((column) => column.name === "last_submission_ordinal"),
    ).toBe(true);
  } finally {
    firstConnection.close();
    secondConnection.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("migrates a legacy test-session status constraint without losing terminal rows", () => {
  const legacyDb = new DatabaseSync(":memory:");
  legacyDb.exec(`
    CREATE TABLE test_sessions (
      id TEXT PRIMARY KEY, learner_id TEXT NOT NULL, subject TEXT NOT NULL,
      grade TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active', 'completed')),
      score INTEGER NOT NULL DEFAULT 0, last_submission_hash TEXT,
      last_submission_ordinal INTEGER, created_at TEXT NOT NULL, completed_at TEXT
    );
    INSERT INTO test_sessions
      (id, learner_id, subject, grade, status, score, created_at, completed_at)
    VALUES ('completed-test', 'learner', 'Mathematics', 'Grade 6', 'completed',
      180, '2026-08-16T10:00:00.000Z', '2026-08-16T10:10:00.000Z');
  `);

  expect(migrateTestSessionStatusForPartial(legacyDb)).toBe(true);
  expect(migrateTestSessionStatusForPartial(legacyDb)).toBe(false);
  legacyDb
    .prepare(
      `INSERT INTO test_sessions
        (id, learner_id, subject, grade, status, score, created_at, completed_at)
       VALUES (?, ?, ?, ?, 'partial', 10, ?, ?)`,
    )
    .run(
      "partial-test",
      "learner",
      "Mathematics",
      "Grade 6",
      "2026-08-16T11:00:00.000Z",
      "2026-08-16T11:01:00.000Z",
    );
  expect(
    legacyDb
      .prepare("SELECT status, score FROM test_sessions WHERE id = ?")
      .get("completed-test"),
  ).toEqual({ status: "completed", score: 180 });
  legacyDb.close();
});
