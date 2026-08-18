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
    user_version: 11,
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
    user_version: 11,
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

test("current migration adds parent identity tables when a legacy account store has no sessions", () => {
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
    user_version: 11,
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
  expect(
    database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'parent_relationship_events'",
      )
      .get(),
  ).toEqual({ name: "parent_relationship_events" });
  database.close();
});

test("v10 rebuilds compatible audit rows with fixed reasons and immutability", () => {
  const database = new DatabaseSync(temporaryDatabasePath());
  database.exec(`
    CREATE TABLE accounts (account_id TEXT PRIMARY KEY);
    INSERT INTO accounts (account_id) VALUES ('parent'), ('child');
    CREATE TABLE parent_relationship_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_account_id TEXT NOT NULL,
      child_account_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      reason TEXT,
      created_at INTEGER NOT NULL
    );
    INSERT INTO parent_relationship_events
      (parent_account_id, child_account_id, event_type, reason, created_at)
    VALUES ('parent', 'child', 'child-created', 'parent-requested', 1);
    PRAGMA user_version = 9;
  `);

  migrateDatabase(database);

  expect(database.prepare("PRAGMA user_version").get()).toEqual({
    user_version: 11,
  });
  expect(() =>
    database
      .prepare(
        `INSERT INTO parent_relationship_events
          (parent_account_id, child_account_id, event_type, reason, created_at)
         VALUES ('parent', 'child', 'link-revoked', 'free text', 2)`,
      )
      .run(),
  ).toThrow();
  expect(() =>
    database
      .prepare("DELETE FROM parent_relationship_events WHERE id = 1")
      .run(),
  ).toThrow("parent relationship audit events are immutable");
  database.close();
});

test("v10 fails closed when a pre-existing audit table is malformed", () => {
  const database = new DatabaseSync(temporaryDatabasePath());
  database.exec(`
    CREATE TABLE accounts (account_id TEXT PRIMARY KEY);
    CREATE TABLE parent_relationship_events (id INTEGER PRIMARY KEY);
    PRAGMA user_version = 9;
  `);

  expect(() => migrateDatabase(database)).toThrow(
    "Existing parent relationship audit table is incompatible",
  );
  expect(database.prepare("PRAGMA user_version").get()).toEqual({
    user_version: 9,
  });
  database.close();
});

test("concurrent startup connections converge on one current schema", () => {
  const path = temporaryDatabasePath();
  process.env.ODYSSEY_DB_PATH = path;
  const first = openDatabase("learning");
  const second = openDatabase("learning");
  try {
    expect(first.prepare("PRAGMA user_version").get()).toEqual({
      user_version: 11,
    });
    expect(second.prepare("PRAGMA user_version").get()).toEqual({
      user_version: 11,
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

test("migration v11 creates suggestion tables with immutable audit", () => {
  const database = new DatabaseSync(temporaryDatabasePath());
  configureSqliteConnection(database);
  migrateDatabase(database);
  expect(database.prepare("PRAGMA user_version").get()).toEqual({
    user_version: 11,
  });
  // Idempotent re-run: same version, artifacts unchanged.
  migrateDatabase(database);
  expect(database.prepare("PRAGMA user_version").get()).toEqual({
    user_version: 11,
  });

  database.exec(`
    INSERT INTO accounts (account_id, username, password_hash, salt, role)
    VALUES ('p', 'sugg-parent', x'00', x'00', 'parent'),
           ('c', 'sugg-child', x'00', x'00', 'student');
    INSERT INTO parent_practice_suggestions
      (id, child_scope, parent_account_id, topic_id, standard_code,
       template_key, state, created_at, transitioned_at)
    VALUES
      ('s1', 'child:one', 'p', 'Mathematics::Grade 8::Expressions::8.EE.7', '8.EE.7',
       'practice-together', 'active', 1, 1),
      ('s2', 'child:one', 'p', 'Mathematics::Grade 8::Expressions::8.EE.9', '8.EE.9',
       'practice-together', 'accepted', 1, 2);
    INSERT INTO parent_suggestion_events
      (suggestion_id, actor, event_type, created_at)
    VALUES ('s1', 'p', 'suggested', 1);
  `);
  // One active suggestion per child.
  expect(() =>
    database.exec(`
      INSERT INTO parent_practice_suggestions
        (id, child_scope, parent_account_id, topic_id, standard_code,
         template_key, state, created_at, transitioned_at)
      VALUES ('s3', 'child:one', 'p', 'x', 'X', 'practice-together', 'active', 1, 1);
    `),
  ).toThrow(/UNIQUE/);
  // Template policy is structural.
  expect(() =>
    database.exec(`
      INSERT INTO parent_practice_suggestions
        (id, child_scope, parent_account_id, topic_id, standard_code,
         template_key, state, created_at, transitioned_at)
      VALUES ('s4', 'child:one', 'p', 'x', 'X', 'custom-note', 'active', 1, 1);
    `),
  ).toThrow(/CHECK/);
  // Audit rows are immutable.
  expect(() =>
    database.exec(
      "UPDATE parent_suggestion_events SET event_type = 'accepted'",
    ),
  ).toThrow(/immutable/);
  expect(() => database.exec("DELETE FROM parent_suggestion_events")).toThrow(
    /immutable/,
  );
});
