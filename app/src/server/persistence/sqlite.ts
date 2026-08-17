import "server-only";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const DEFAULT_LEARNING_DATABASE_PATH = "odyssey-learning.db";
const DEFAULT_CURRICULUM_DATABASE_PATH = "odyssey-curriculum.db";
const BUSY_TIMEOUT_MS = 5_000;
const LATEST_SCHEMA_VERSION = 9;

export type DatabaseKind = "learning" | "curriculum" | "promotion";

/** Resolves an absolute configured path or an absolute local default path. */
export function resolveDatabasePath(kind: DatabaseKind): string {
  const configured =
    kind === "learning"
      ? process.env.ODYSSEY_DB_PATH
      : kind === "promotion"
        ? (process.env.ODYSSEY_CURRICULUM_DB_PATH ??
          process.env.ODYSSEY_DB_PATH)
        : process.env.ODYSSEY_CURRICULUM_DB_PATH;
  if (configured === ":memory:") return configured;
  if (configured) {
    if (!isAbsolute(configured))
      throw new Error(`Configured ${kind} database path must be absolute`);
    return configured;
  }
  return resolve(
    process.cwd(),
    kind === "learning"
      ? DEFAULT_LEARNING_DATABASE_PATH
      : DEFAULT_CURRICULUM_DATABASE_PATH,
  );
}

/** Applies the SQLite connection policy required by every application database. */
export function configureSqliteConnection(database: DatabaseSync): void {
  database.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
  database.exec("PRAGMA journal_mode = WAL");
  database.exec("PRAGMA foreign_keys = ON");
}

/** Opens an application database, configures it, and brings its schema current. */
export function openDatabase(kind: DatabaseKind): DatabaseSync {
  const path = resolveDatabasePath(kind);
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const database = new DatabaseSync(path, {
    allowExtension: kind !== "learning",
  });
  configureSqliteConnection(database);
  migrateDatabase(database);
  return database;
}

/** Runs every ordered application migration once while holding SQLite's write lock. */
export function migrateDatabase(database: DatabaseSync): void {
  // Rebuilding a legacy parent table requires foreign-key checks to be toggled
  // before the transaction; every returned application connection restores them.
  database.exec("PRAGMA foreign_keys = OFF");
  let transactionStarted = false;
  try {
    database.exec("BEGIN IMMEDIATE");
    transactionStarted = true;
    let version = readSchemaVersion(database);
    if (version > LATEST_SCHEMA_VERSION)
      throw new Error(
        "Database schema is newer than this application supports",
      );

    for (const migration of MIGRATIONS) {
      if (migration.version <= version) continue;
      migration.apply(database);
      database.exec(`PRAGMA user_version = ${migration.version}`);
      version = migration.version;
    }
    database.exec("COMMIT");
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) database.exec("ROLLBACK");
    throw error;
  } finally {
    database.exec("PRAGMA foreign_keys = ON");
  }
}

function readSchemaVersion(database: DatabaseSync): number {
  return (
    database.prepare("PRAGMA user_version").get() as { user_version: number }
  ).user_version;
}

type Migration = {
  readonly version: number;
  readonly apply: (database: DatabaseSync) => void;
};

/** The sole ordered owner of application-owned SQLite schema changes. */
const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    apply(database) {
      database.exec(`
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
        );
        CREATE TABLE IF NOT EXISTS test_sessions (
          id TEXT PRIMARY KEY, learner_id TEXT NOT NULL, subject TEXT NOT NULL,
          grade TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'partial')),
          score INTEGER NOT NULL DEFAULT 0, last_submission_hash TEXT,
          last_submission_ordinal INTEGER, created_at TEXT NOT NULL, completed_at TEXT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS test_sessions_one_active_learner
          ON test_sessions (learner_id) WHERE status = 'active';
        CREATE INDEX IF NOT EXISTS test_sessions_learner_status
          ON test_sessions (learner_id, status);
        CREATE TABLE IF NOT EXISTS test_selected_records (
          test_session_id TEXT NOT NULL REFERENCES test_sessions(id),
          selection_ordinal INTEGER NOT NULL, gold_record_id TEXT NOT NULL,
          subject TEXT NOT NULL, grade TEXT NOT NULL, content_json TEXT NOT NULL,
          content_fingerprint TEXT NOT NULL,
          PRIMARY KEY (test_session_id, selection_ordinal),
          UNIQUE (test_session_id, gold_record_id)
        );
        CREATE TABLE IF NOT EXISTS test_questions (
          test_session_id TEXT NOT NULL REFERENCES test_sessions(id), ordinal INTEGER NOT NULL,
          gold_record_id TEXT NOT NULL, gold_content_fingerprint TEXT NOT NULL,
          planned_difficulty INTEGER NOT NULL CHECK (planned_difficulty BETWEEN 1 AND 3),
          preparation_status TEXT NOT NULL DEFAULT 'pending'
            CHECK (preparation_status IN ('pending', 'preparing', 'ready', 'unavailable')),
          preparation_lease_token TEXT, preparation_lease_until INTEGER,
          question_payload_json TEXT, expected_answer TEXT, acceptable_answers_json TEXT,
          assignment_token TEXT, generator_content_version TEXT,
          validation_schema_version TEXT, validation_outcome TEXT, question_text_hash TEXT,
          correct INTEGER, points INTEGER, graded_at TEXT,
          PRIMARY KEY (test_session_id, ordinal),
          FOREIGN KEY (test_session_id, gold_record_id)
            REFERENCES test_selected_records(test_session_id, gold_record_id)
        );
        CREATE INDEX IF NOT EXISTS test_questions_session_ordinal
          ON test_questions (test_session_id, ordinal);
        CREATE UNIQUE INDEX IF NOT EXISTS test_questions_unique_text_per_session
          ON test_questions (test_session_id, question_text_hash)
          WHERE question_text_hash IS NOT NULL;
        CREATE TABLE IF NOT EXISTS accounts (
          username TEXT PRIMARY KEY, password_hash BLOB NOT NULL, salt BLOB NOT NULL,
          role TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS auth_sessions (
          token_hash TEXT PRIMARY KEY, child_id TEXT NOT NULL, username TEXT NOT NULL,
          role TEXT NOT NULL, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL,
          generated_requests INTEGER NOT NULL DEFAULT 0, allowance_topic TEXT,
          question_pool TEXT
        );
        CREATE TABLE IF NOT EXISTS failed_logins (
          username TEXT PRIMARY KEY, count INTEGER NOT NULL, first_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS promotion_workflows (
          id TEXT PRIMARY KEY, stage TEXT NOT NULL, bronze_json TEXT, source_bytes BLOB,
          silver_json TEXT, gold_json TEXT, expires_at INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS gold_curriculum_records (
          record_id TEXT PRIMARY KEY, subject TEXT NOT NULL, framework TEXT NOT NULL,
          content_json TEXT NOT NULL, source_fingerprint TEXT NOT NULL,
          prompt_version TEXT NOT NULL, model TEXT NOT NULL, created_at TEXT NOT NULL
        );
      `);
    },
  },
  {
    version: 2,
    apply(database) {
      addColumnIfMissing(
        database,
        "test_sessions",
        "last_submission_ordinal",
        "INTEGER",
      );
    },
  },
  {
    version: 3,
    apply(database) {
      const schema = database
        .prepare(
          "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'test_sessions'",
        )
        .get() as { sql: string } | undefined;
      if (!schema || /['"]partial['"]/i.test(schema.sql)) return;
      database.exec(`
        CREATE TABLE test_sessions_partial_migration (
          id TEXT PRIMARY KEY, learner_id TEXT NOT NULL, subject TEXT NOT NULL,
          grade TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'partial')),
          score INTEGER NOT NULL DEFAULT 0, last_submission_hash TEXT,
          last_submission_ordinal INTEGER, created_at TEXT NOT NULL, completed_at TEXT
        );
        INSERT INTO test_sessions_partial_migration
          (id, learner_id, subject, grade, status, score, last_submission_hash,
           last_submission_ordinal, created_at, completed_at)
        SELECT id, learner_id, subject, grade, status, score, last_submission_hash,
          last_submission_ordinal, created_at, completed_at FROM test_sessions;
        DROP TABLE test_sessions;
        ALTER TABLE test_sessions_partial_migration RENAME TO test_sessions;
        CREATE UNIQUE INDEX test_sessions_one_active_learner
          ON test_sessions (learner_id) WHERE status = 'active';
        CREATE INDEX test_sessions_learner_status ON test_sessions (learner_id, status);
      `);
    },
  },
  {
    version: 4,
    apply(database) {
      addColumnIfMissing(
        database,
        "test_questions",
        "assignment_token",
        "TEXT",
      );
      database.exec(`CREATE UNIQUE INDEX IF NOT EXISTS test_questions_assignment_token
        ON test_questions (assignment_token) WHERE assignment_token IS NOT NULL`);
    },
  },
  {
    version: 5,
    apply(database) {
      if (hasColumn(database, "learning_attempts", "answer"))
        database
          .prepare("UPDATE learning_attempts SET answer = ? WHERE answer <> ?")
          .run("[redacted]", "[redacted]");
    },
  },
  {
    version: 6,
    apply(database) {
      addColumnIfMissing(
        database,
        "promotion_workflows",
        "expires_at",
        "INTEGER",
      );
      database
        .prepare(
          "UPDATE promotion_workflows SET expires_at = ? WHERE expires_at IS NULL",
        )
        .run(Date.now());
      database.exec(
        "CREATE INDEX IF NOT EXISTS promotion_workflows_expires_at ON promotion_workflows (expires_at)",
      );
    },
  },
  {
    version: 7,
    apply(database) {
      if (!hasColumn(database, "auth_sessions", "active_ai_question")) return;
      database.exec(`
        CREATE TABLE auth_sessions_without_active_ai_question (
          token_hash TEXT PRIMARY KEY, child_id TEXT NOT NULL, username TEXT NOT NULL,
          role TEXT NOT NULL, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL,
          generated_requests INTEGER NOT NULL DEFAULT 0, allowance_topic TEXT,
          question_pool TEXT
        );
        INSERT INTO auth_sessions_without_active_ai_question
          (token_hash, child_id, username, role, created_at, last_seen,
           generated_requests, allowance_topic, question_pool)
        SELECT token_hash, child_id, username, role, created_at, last_seen,
               generated_requests, allowance_topic, question_pool
          FROM auth_sessions;
        DROP TABLE auth_sessions;
        ALTER TABLE auth_sessions_without_active_ai_question RENAME TO auth_sessions;
      `);
    },
  },
  {
    version: 8,
    apply(database) {
      // Some legacy test fixtures predate the account subsystem entirely.
      if (!hasTable(database, "accounts")) return;
      addColumnIfMissing(database, "accounts", "account_id", "TEXT");
      if (hasTable(database, "auth_sessions"))
        addColumnIfMissing(database, "auth_sessions", "principal_id", "TEXT");
      database.exec(`
        UPDATE accounts
        SET account_id = lower(hex(randomblob(16)))
        WHERE account_id IS NULL OR account_id = '';
        CREATE UNIQUE INDEX IF NOT EXISTS accounts_account_id_unique
          ON accounts(account_id);
        CREATE TABLE IF NOT EXISTS parent_child_links (
          parent_account_id TEXT NOT NULL REFERENCES accounts(account_id),
          child_account_id TEXT NOT NULL REFERENCES accounts(account_id),
          created_at INTEGER NOT NULL,
          revoked_at INTEGER,
          PRIMARY KEY (parent_account_id, child_account_id),
          CHECK (parent_account_id <> child_account_id)
        );
        CREATE INDEX IF NOT EXISTS parent_child_links_active_parent
          ON parent_child_links(parent_account_id, child_account_id)
          WHERE revoked_at IS NULL;
        CREATE TABLE IF NOT EXISTS external_identity_links (
          account_id TEXT NOT NULL REFERENCES accounts(account_id),
          provider TEXT NOT NULL,
          provider_subject TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          PRIMARY KEY (provider, provider_subject),
          UNIQUE (account_id, provider)
        );
      `);
      if (hasTable(database, "auth_sessions"))
        database.exec(`
          UPDATE auth_sessions
          SET principal_id = (
            SELECT account_id FROM accounts WHERE accounts.username = auth_sessions.username
          )
          WHERE principal_id IS NULL OR principal_id = '';
        `);
    },
  },
  {
    version: 9,
    apply(database) {
      if (!hasTable(database, "accounts")) return;
      database.exec(`
        CREATE TABLE IF NOT EXISTS parent_relationship_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          parent_account_id TEXT NOT NULL REFERENCES accounts(account_id),
          child_account_id TEXT NOT NULL REFERENCES accounts(account_id),
          event_type TEXT NOT NULL CHECK (
            event_type IN ('child-created', 'password-reset', 'link-revoked')
          ),
          reason TEXT,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS parent_relationship_events_parent_created
          ON parent_relationship_events(parent_account_id, created_at DESC);
      `);
    },
  },
];

function hasTable(database: DatabaseSync, table: string): boolean {
  return Boolean(
    database
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table),
  );
}

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

function addColumnIfMissing(
  database: DatabaseSync,
  table:
    | "accounts"
    | "auth_sessions"
    | "promotion_workflows"
    | "test_questions"
    | "test_sessions",
  column: string,
  definition: string,
): void {
  if (!hasColumn(database, table, column))
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
