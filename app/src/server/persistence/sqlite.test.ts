import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, expect, test } from "vitest";
import {
  configureSqliteConnection,
  migrateDatabase,
  openDatabase,
  resolveDatabasePath,
} from "./sqlite";

const originalLearningPath = process.env.ODYSSEY_DB_PATH;
const directories: string[] = [];

afterEach(() => {
  if (originalLearningPath === undefined) delete process.env.ODYSSEY_DB_PATH;
  else process.env.ODYSSEY_DB_PATH = originalLearningPath;
  for (const directory of directories.splice(0))
    rmSync(directory, { force: true, recursive: true });
});

function temporaryDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "odyssey-migrations-"));
  directories.push(directory);
  return join(directory, "learning.db");
}

test("requires configured database paths to be absolute", () => {
  process.env.ODYSSEY_DB_PATH = "relative-learning.db";
  expect(() => resolveDatabasePath("learning")).toThrow(
    "Configured learning database path must be absolute",
  );
});

test("upgrades a legacy schema without losing session rows", () => {
  const path = temporaryDatabasePath();
  const legacy = new DatabaseSync(path);
  legacy.exec(`
    CREATE TABLE learning_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, child_id TEXT NOT NULL,
      topic_id TEXT NOT NULL, answer TEXT NOT NULL, correct INTEGER NOT NULL,
      level_before INTEGER NOT NULL, level_after INTEGER NOT NULL, created_at TEXT NOT NULL
    );
    INSERT INTO learning_attempts
      (child_id, topic_id, answer, correct, level_before, level_after, created_at)
      VALUES ('learner', 'ratio', 'private response', 1, 1, 2, '2026-01-01');
    CREATE TABLE test_sessions (
      id TEXT PRIMARY KEY, learner_id TEXT NOT NULL, subject TEXT NOT NULL,
      grade TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('active', 'completed')),
      score INTEGER NOT NULL DEFAULT 0, last_submission_hash TEXT,
      created_at TEXT NOT NULL, completed_at TEXT
    );
    INSERT INTO test_sessions
      (id, learner_id, subject, grade, status, score, created_at)
      VALUES ('session', 'learner', 'Mathematics', 'Grade 6', 'completed', 10, '2026-01-01');
  `);
  legacy.close();

  const database = new DatabaseSync(path);
  configureSqliteConnection(database);
  migrateDatabase(database);
  expect(database.prepare("PRAGMA user_version").get()).toEqual({
    user_version: 8,
  });
  expect(
    database.prepare("SELECT status, score FROM test_sessions").get(),
  ).toEqual({
    status: "completed",
    score: 10,
  });
  expect(
    database.prepare("SELECT answer FROM learning_attempts").get(),
  ).toEqual({
    answer: "[redacted]",
  });
  expect(
    (
      database.prepare("PRAGMA table_info(test_sessions)").all() as Array<{
        name: string;
      }>
    ).some((column) => column.name === "last_submission_ordinal"),
  ).toBe(true);
  expect(
    (
      database
        .prepare("PRAGMA table_info(promotion_workflows)")
        .all() as Array<{
        name: string;
      }>
    ).some((column) => column.name === "expires_at"),
  ).toBe(true);
  database.close();
});

test("removes orphaned active AI question state without losing sessions", () => {
  const database = new DatabaseSync(temporaryDatabasePath());
  database.exec(`
    CREATE TABLE auth_sessions (
      token_hash TEXT PRIMARY KEY, child_id TEXT NOT NULL, username TEXT NOT NULL,
      role TEXT NOT NULL, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL,
      generated_requests INTEGER NOT NULL DEFAULT 0, allowance_topic TEXT,
      active_ai_question TEXT, question_pool TEXT
    );
    INSERT INTO auth_sessions
      (token_hash, child_id, username, role, created_at, last_seen,
       generated_requests, allowance_topic, active_ai_question, question_pool)
    VALUES ('hash', 'child', 'learner', 'student', 1, 2, 3, 'ratio',
            '{"answer":"2"}', '{"topicId":"ratio"}');
    PRAGMA user_version = 6;
  `);

  migrateDatabase(database);

  expect(database.prepare("PRAGMA user_version").get()).toEqual({
    user_version: 8,
  });
  expect(
    database
      .prepare(
        "SELECT token_hash, child_id, allowance_topic, question_pool FROM auth_sessions",
      )
      .get(),
  ).toEqual({
    token_hash: "hash",
    child_id: "child",
    allowance_topic: "ratio",
    question_pool: '{"topicId":"ratio"}',
  });
  expect(
    (
      database.prepare("PRAGMA table_info(auth_sessions)").all() as Array<{
        name: string;
      }>
    ).map((column) => column.name),
  ).not.toContain("active_ai_question");
  database.close();
});

test("v8 adds parent identity tables when a legacy account store has no sessions", () => {
  const database = new DatabaseSync(temporaryDatabasePath());
  database.exec(`
    CREATE TABLE accounts (
      username TEXT PRIMARY KEY, password_hash BLOB NOT NULL,
      salt BLOB NOT NULL, role TEXT NOT NULL
    );
    INSERT INTO accounts (username, password_hash, salt, role)
      VALUES ('legacy-parent', x'00', x'00', 'parent');
    PRAGMA user_version = 7;
  `);

  migrateDatabase(database);

  expect(database.prepare("PRAGMA user_version").get()).toEqual({
    user_version: 8,
  });
  expect(
    database.prepare("SELECT account_id FROM accounts").get(),
  ).toMatchObject({ account_id: expect.stringMatching(/^[a-f0-9]{32}$/) });
  expect(
    database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'parent_child_links'",
      )
      .get(),
  ).toEqual({ name: "parent_child_links" });
  database.close();
});

test("concurrent startup connections converge on one current schema", () => {
  const path = temporaryDatabasePath();
  process.env.ODYSSEY_DB_PATH = path;
  const first = openDatabase("learning");
  const second = openDatabase("learning");
  try {
    expect(first.prepare("PRAGMA user_version").get()).toEqual({
      user_version: 8,
    });
    expect(second.prepare("PRAGMA user_version").get()).toEqual({
      user_version: 8,
    });
    expect(second.prepare("PRAGMA foreign_keys").get()).toEqual({
      foreign_keys: 1,
    });
    expect(second.prepare("PRAGMA journal_mode").get()).toEqual({
      journal_mode: "wal",
    });
    expect(second.prepare("PRAGMA busy_timeout").get()).toEqual({
      timeout: 5000,
    });
    expect(
      second
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'auth_sessions'",
        )
        .get(),
    ).toEqual({ name: "auth_sessions" });
  } finally {
    first.close();
    second.close();
  }
});
