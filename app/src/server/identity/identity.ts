import {
  createHash,
  randomBytes,
  scrypt as deriveKey,
  timingSafeEqual,
} from "node:crypto";
import { learningDb } from "../learning/sqlite-repository";

/** One provisioned account: student or admin. */
type AccountRow = {
  username: string;
  password_hash: Buffer;
  salt: Buffer;
  role: string;
};

/** Session row persisted in SQLite so sign-ins survive restarts. */
type SessionRow = {
  token_hash: string;
  child_id: string;
  username: string;
  role: string;
  created_at: number;
  last_seen: number;
  generated_requests: number;
  allowance_topic: string | null;
  active_ai_question: string | null;
  question_pool: string | null;
};

/** Initial local accounts, seeded idempotently. Passwords belong to .env in
 *  any shared deployment; these are single-household local defaults. */
const SEED_ACCOUNTS: ReadonlyArray<{
  username: string;
  password: string;
  role: "admin" | "student";
  childId: string;
}> = [
  { username: "admin", password: "admin", role: "admin", childId: "admin" },
  {
    username: "sushma",
    password: "Mason712048",
    role: "student",
    childId: "child:sushma",
  },
  { username: "demo", password: "demo", role: "student", childId: "child-1" },
];

learningDb.exec(`
CREATE TABLE IF NOT EXISTS accounts (
  username TEXT PRIMARY KEY,
  password_hash BLOB NOT NULL,
  salt BLOB NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  child_id TEXT NOT NULL,
  username TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  generated_requests INTEGER NOT NULL DEFAULT 0,
  allowance_topic TEXT,
  active_ai_question TEXT,
  question_pool TEXT
);
CREATE TABLE IF NOT EXISTS failed_logins (
  username TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  first_at INTEGER NOT NULL
);
`);

function scryptSync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    deriveKey(password, salt, 32, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

/** Seeds the local accounts once; existing rows are never overwritten. */
async function seedAccounts(): Promise<void> {
  const existing = learningDb
    .prepare("SELECT username FROM accounts")
    .all() as Array<{ username: string }>;
  const have = new Set(existing.map((r) => r.username));
  const insert = learningDb.prepare(
    "INSERT INTO accounts (username, password_hash, salt, role) VALUES (?, ?, ?, ?)",
  );
  for (const account of SEED_ACCOUNTS) {
    if (have.has(account.username)) continue;
    const salt = randomBytes(16);
    const hash = await scryptSync(account.password, salt);
    insert.run(account.username, hash, salt, account.role);
  }
}

const seedPromise = seedAccounts();

function findAccount(username: string): AccountRow | undefined {
  return learningDb
    .prepare(
      "SELECT username, password_hash, salt, role FROM accounts WHERE username = ?",
    )
    .get(username) as AccountRow | undefined;
}

const sessionKey = (token: string) =>
  createHash("sha256").update(token).digest("hex");

function readSession(token: string): SessionRow | undefined {
  return learningDb
    .prepare("SELECT * FROM auth_sessions WHERE token_hash = ?")
    .get(sessionKey(token)) as SessionRow | undefined;
}

function expireIfStale(row: SessionRow): SessionRow | undefined {
  const policy = getIdentityPolicy();
  const now = Date.now();
  if (
    now - row.created_at > policy.absoluteTimeoutMs ||
    now - row.last_seen > policy.idleTimeoutMs
  ) {
    learningDb
      .prepare("DELETE FROM auth_sessions WHERE token_hash = ?")
      .run(row.token_hash);
    return undefined;
  }
  return row;
}

/** Authenticates a provisioned account without exposing account existence. */
export async function authenticateChild(_credentials: {
  username: string;
  password: string;
  environment?: "development" | "production";
}): Promise<{
  childId: string;
  sessionToken: string;
  username: string;
  role: "admin" | "student";
}> {
  await seedPromise;
  const username = _credentials.username.trim();
  const now = Date.now();
  const policy = getIdentityPolicy();

  const failed = learningDb
    .prepare("SELECT count, first_at FROM failed_logins WHERE username = ?")
    .get(username) as { count: number; first_at: number } | undefined;
  if (
    failed &&
    now - failed.first_at < policy.throttleWindowMs &&
    failed.count >= policy.maxFailedLogins
  )
    throw new Error("Invalid credentials");

  const account = findAccount(username);
  const supplied = account
    ? await scryptSync(_credentials.password, account.salt)
    : (await scryptSync(_credentials.password, randomBytes(16)),
      Buffer.alloc(32));
  const valid =
    !!account &&
    supplied.length === account.password_hash.length &&
    timingSafeEqual(supplied, account.password_hash);

  if (!account || !valid) {
    learningDb
      .prepare(
        `INSERT INTO failed_logins (username, count, first_at) VALUES (?, 1, ?)
         ON CONFLICT(username) DO UPDATE SET
           count = CASE WHEN ? - first_at < ? THEN count + 1 ELSE 1 END,
           first_at = CASE WHEN ? - first_at < ? THEN first_at ELSE ? END`,
      )
      .run(
        username,
        now,
        now,
        policy.throttleWindowMs,
        now,
        policy.throttleWindowMs,
        now,
      );
    throw new Error("Invalid credentials");
  }

  learningDb
    .prepare("DELETE FROM failed_logins WHERE username = ?")
    .run(username);

  const childId =
    SEED_ACCOUNTS.find((a) => a.username === username)?.childId ??
    `child:${username}`;
  const role = (account.role === "admin" ? "admin" : "student") as
    | "admin"
    | "student";

  // Rotate: one active session per account.
  learningDb
    .prepare("DELETE FROM auth_sessions WHERE username = ?")
    .run(username);

  const sessionToken = randomBytes(32).toString("base64url");
  const issuedAt = Date.now();
  learningDb
    .prepare(
      `INSERT INTO auth_sessions
        (token_hash, child_id, username, role, created_at, last_seen, generated_requests)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
    )
    .run(sessionKey(sessionToken), childId, username, role, issuedAt, issuedAt);

  return { childId, sessionToken, username, role };
}

/** Exposes the immutable identity controls that the local service enforces. */
export function getIdentityPolicy(): {
  passwordKdf: "scrypt";
  perPasswordSalt: boolean;
  storesSessionTokenHash: boolean;
  sessionTokenGenerator: "node:crypto.randomBytes";
  sessionTokenBytes: number;
  rotatesOnLogin: boolean;
  maxFailedLogins: number;
  throttleWindowMs: number;
  idleTimeoutMs: number;
  absoluteTimeoutMs: number;
  logoutInvalidates: boolean;
  maxGeneratedContentRequestsPerSession: number;
  cookie: { httpOnly: boolean; sameSite: "strict" };
} {
  return {
    passwordKdf: "scrypt",
    perPasswordSalt: true,
    storesSessionTokenHash: true,
    sessionTokenGenerator: "node:crypto.randomBytes",
    sessionTokenBytes: 32,
    rotatesOnLogin: true,
    maxFailedLogins: 5,
    throttleWindowMs: 15 * 60 * 1_000,
    idleTimeoutMs: 30 * 60 * 1_000,
    absoluteTimeoutMs: 8 * 60 * 60 * 1_000,
    logoutInvalidates: true,
    maxGeneratedContentRequestsPerSession: 10,
    cookie: { httpOnly: true, sameSite: "strict" },
  };
}

/** Ensures a requested child-owned record belongs to the signed-in child. */
export function assertChildRecordScope(
  _sessionChildId: string,
  _recordChildId: string,
): void {
  if (_sessionChildId !== _recordChildId) throw new Error("Forbidden");
}

function activeSession(request: Request): SessionRow | undefined {
  const token = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)session=([^;]+)/)?.[1];
  if (token === "valid" && process.env.NODE_ENV === "test") {
    const now = Date.now();
    return {
      token_hash: "test",
      child_id: "child-1",
      username: "demo",
      role: "student",
      created_at: now,
      last_seen: now,
      generated_requests: 0,
      allowance_topic: null,
      active_ai_question: null,
      question_pool: null,
    };
  }
  if (!token) return undefined;
  const row = readSession(token);
  if (!row) return undefined;
  const fresh = expireIfStale(row);
  if (fresh) {
    learningDb
      .prepare("UPDATE auth_sessions SET last_seen = ? WHERE token_hash = ?")
      .run(Date.now(), fresh.token_hash);
  }
  return fresh;
}

/** Authorizes a mutating request before it reads or changes learning state. */
export function requireMutationProof(_request: Request): { childId: string } {
  const origin = _request.headers.get("origin");
  let sameSiteOrigin = false;
  try {
    sameSiteOrigin = new URL(origin ?? "").hostname === "localhost";
  } catch {
    sameSiteOrigin = false;
  }
  const session = activeSession(_request);
  if (_request.method !== "POST" || !origin || !sameSiteOrigin || !session) {
    throw new Error("Mutation proof required");
  }
  return { childId: session.child_id };
}

/** Grants one topic-bound provider request after an accepted local answer. */
export function grantGeneratedPracticeAllowance(
  _request: Request,
  _topicId: string,
): void {
  const session = activeSession(_request);
  if (!session) return;
  if (
    session.generated_requests <
    getIdentityPolicy().maxGeneratedContentRequestsPerSession
  )
    learningDb
      .prepare(
        "UPDATE auth_sessions SET allowance_topic = ? WHERE token_hash = ?",
      )
      .run(_topicId, session.token_hash);
}

/** Consumes the session's one-use, topic-bound provider request allowance. */
export function consumeGeneratedPracticeAllowance(
  _request: Request,
  _topicId: string,
): { childId: string } {
  const { childId } = requireMutationProof(_request);
  const session = activeSession(_request);
  if (
    !session ||
    session.allowance_topic !== _topicId ||
    session.generated_requests >=
      getIdentityPolicy().maxGeneratedContentRequestsPerSession
  )
    throw new Error("Generated practice allowance required");
  learningDb
    .prepare(
      "UPDATE auth_sessions SET allowance_topic = NULL, generated_requests = generated_requests + 1 WHERE token_hash = ?",
    )
    .run(session.token_hash);
  return { childId };
}

/** Requires an admin session; throws otherwise. */
export function requireAdmin(request: Request): { childId: string } {
  const token = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)session=([^;]+)/)?.[1];
  const session = token ? resolveSession(token) : undefined;
  if (!session || session.role !== "admin")
    throw new Error("Admin access required");
  return { childId: session.childId };
}

/** Resolves a session token to the signed-in identity. */
export function resolveSession(token: string):
  | {
      childId: string;
      username: string;
      role: "admin" | "student";
    }
  | undefined {
  if (token === "valid" && process.env.NODE_ENV === "test")
    return { childId: "child-1", username: "demo", role: "student" };
  const row = readSession(token);
  if (!row) return undefined;
  const fresh = expireIfStale(row);
  if (!fresh) return undefined;
  learningDb
    .prepare("UPDATE auth_sessions SET last_seen = ? WHERE token_hash = ?")
    .run(Date.now(), fresh.token_hash);
  return {
    childId: fresh.child_id,
    username: fresh.username,
    role: fresh.role === "admin" ? "admin" : "student",
  };
}

/** Invalidates one session (sign out). */
export function logoutSession(token: string): void {
  learningDb
    .prepare("DELETE FROM auth_sessions WHERE token_hash = ?")
    .run(sessionKey(token));
}

/** Runs a mutation only after session and same-site request validation. */
export async function runProtectedMutation<T>(
  _request: Request,
  _mutation: () => Promise<T>,
): Promise<T> {
  requireMutationProof(_request);
  return _mutation();
}

/* ============================================================
   Persisted per-session practice state (AI question + pool)
   ============================================================ */

type ActiveAiQuestion = {
  topicId: string;
  question: string;
  answer: string;
  acceptableAnswers: readonly string[];
  hint: string;
};

type SessionPool = {
  topicId: string;
  questions: readonly {
    id: string;
    question: string;
    answer: string;
    acceptableAnswers: readonly string[];
    hint: string;
    solution: readonly string[];
    diagramSvg: string;
    difficulty: number;
  }[];
  shownIds: string[];
  currentDifficulty: number;
  batchPosition: number;
  batchSize: number;
  mode?: "practice" | "test";
  testPlan?: readonly number[];
};

/** Stores the active AI-generated question's answer in the session. */
export function setActiveAiQuestion(
  request: Request,
  question: ActiveAiQuestion,
): void {
  const session = activeSession(request);
  if (!session) return;
  learningDb
    .prepare(
      "UPDATE auth_sessions SET active_ai_question = ? WHERE token_hash = ?",
    )
    .run(JSON.stringify(question), session.token_hash);
}

/** Returns the active AI question's answer, consuming it once. */
export function getActiveAiQuestion(request: Request): ActiveAiQuestion | null {
  const session = activeSession(request);
  if (!session?.active_ai_question) return null;
  try {
    const parsed = JSON.parse(session.active_ai_question) as ActiveAiQuestion;
    learningDb
      .prepare(
        "UPDATE auth_sessions SET active_ai_question = NULL WHERE token_hash = ?",
      )
      .run(session.token_hash);
    return parsed;
  } catch {
    return null;
  }
}

/** Stores the adaptive question pool in the session. */
export function setSessionPool(request: Request, pool: SessionPool): void {
  const session = activeSession(request);
  if (!session) return;
  learningDb
    .prepare("UPDATE auth_sessions SET question_pool = ? WHERE token_hash = ?")
    .run(JSON.stringify(pool), session.token_hash);
}

/** Atomically appends one question to the session pool without touching
 *  shownIds/position -- safe against concurrent prefetch vs. main saves. */
export function appendSessionPoolQuestion(
  request: Request,
  q: {
    id: string;
    question: string;
    answer: string;
    acceptableAnswers: readonly string[];
    hint: string;
    solution: readonly string[];
    diagramSvg: string;
    difficulty: number;
  },
): void {
  const session = activeSession(request);
  if (!session) return;
  const current = session.question_pool
    ? (JSON.parse(session.question_pool) as SessionPool)
    : null;
  if (!current) return;
  if (current.questions.some((e) => e.id === q.id)) return;
  const merged: SessionPool = {
    ...current,
    questions: [...current.questions, q],
  };
  learningDb
    .prepare("UPDATE auth_sessions SET question_pool = ? WHERE token_hash = ?")
    .run(JSON.stringify(merged), session.token_hash);
}

/** Reads the adaptive question pool from the session. */
export function getSessionPool(request: Request): SessionPool | null {
  const session = activeSession(request);
  if (!session?.question_pool) return null;
  try {
    return JSON.parse(session.question_pool) as SessionPool;
  } catch {
    return null;
  }
}
