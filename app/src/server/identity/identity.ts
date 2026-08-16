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
  question_pool: string | null;
};

type FixtureAccount = {
  username: string;
  password: string;
  role: "admin" | "student";
  childId: string;
};

/**
 * Generic accounts used only for local verification. They are opt-in in
 * development and separately enabled by Vitest; production never seeds or
 * accepts either account.
 */
const DEVELOPMENT_FIXTURE_ACCOUNTS: readonly FixtureAccount[] = [
  {
    username: "development-admin",
    password: "development-admin-password",
    role: "admin",
    childId: "development-admin",
  },
  {
    username: "development-learner",
    password: "development-learner-password",
    role: "student",
    childId: "development-learner",
  },
];

const TEST_FIXTURE_ACCOUNTS: readonly FixtureAccount[] = [
  {
    username: "test-admin",
    password: "test-admin-password",
    role: "admin",
    childId: "test-admin",
  },
  {
    username: "test-learner",
    password: "test-learner-password",
    role: "student",
    childId: "test-learner",
  },
];

const ALL_FIXTURE_ACCOUNTS = [
  ...DEVELOPMENT_FIXTURE_ACCOUNTS,
  ...TEST_FIXTURE_ACCOUNTS,
] as const;

function testFixturesEnabled(): boolean {
  return (
    process.env.NODE_ENV === "test" &&
    process.env.ODYSSEY_TEST_FIXTURE_ACCOUNTS === "1"
  );
}

function fixtureAccounts(): readonly FixtureAccount[] {
  if (testFixturesEnabled()) return TEST_FIXTURE_ACCOUNTS;
  if (
    process.env.NODE_ENV === "development" &&
    process.env.ODYSSEY_ENABLE_DEVELOPMENT_FIXTURE_ACCOUNTS === "1"
  )
    return DEVELOPMENT_FIXTURE_ACCOUNTS;
  return [];
}

function productionRuntime(
  environment?: "development" | "production",
): boolean {
  return environment === "production" || process.env.NODE_ENV === "production";
}

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
  const accounts = fixtureAccounts();
  if (accounts.length === 0) return;
  const existing = learningDb
    .prepare("SELECT username FROM accounts")
    .all() as Array<{ username: string }>;
  const have = new Set(existing.map((r) => r.username));
  const insert = learningDb.prepare(
    "INSERT INTO accounts (username, password_hash, salt, role) VALUES (?, ?, ?, ?) ON CONFLICT(username) DO NOTHING",
  );
  for (const account of accounts) {
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

/** Removes expired session rows and their session-owned plaintext state opportunistically. */
export function purgeExpiredSessions(now = Date.now()): number {
  const policy = getIdentityPolicy();
  return learningDb
    .prepare(
      `DELETE FROM auth_sessions
       WHERE created_at <= ? OR last_seen <= ?`,
    )
    .run(now - policy.absoluteTimeoutMs, now - policy.idleTimeoutMs)
    .changes as number;
}

function expireIfStale(
  row: SessionRow,
  now = Date.now(),
): SessionRow | undefined {
  const policy = getIdentityPolicy();
  if (
    now - row.created_at >= policy.absoluteTimeoutMs ||
    now - row.last_seen >= policy.idleTimeoutMs
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
  purgeExpiredSessions();
  const username = _credentials.username.trim();
  const enabledFixture =
    !productionRuntime(_credentials.environment) &&
    fixtureAccounts().some((account) => account.username === username);
  if (
    ALL_FIXTURE_ACCOUNTS.some((account) => account.username === username) &&
    !enabledFixture
  )
    throw new Error("Invalid credentials");
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
    fixtureAccounts().find((account) => account.username === username)
      ?.childId ?? `child:${username}`;
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
  const now = Date.now();
  purgeExpiredSessions(now);
  const token = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)session=([^;]+)/)?.[1];
  if (token === "valid" && testFixturesEnabled()) {
    const now = Date.now();
    return {
      token_hash: "test",
      child_id: "test-learner",
      username: "test-learner",
      role: "student",
      created_at: now,
      last_seen: now,
      generated_requests: 0,
      allowance_topic: null,
      question_pool: null,
    };
  }
  if (!token) return undefined;
  const row = readSession(token);
  if (!row) return undefined;
  const fresh = expireIfStale(row, now);
  if (fresh) {
    learningDb
      .prepare("UPDATE auth_sessions SET last_seen = ? WHERE token_hash = ?")
      .run(now, fresh.token_hash);
  }
  return fresh;
}

type SessionIdentity = {
  childId: string;
  role: "admin" | "student";
  /** Server-only binding used by atomic session-owned learning mutations. */
  sessionTokenHash: string;
};

function requireSessionRead(request: Request): SessionIdentity {
  const session = activeSession(request);
  if (!session) throw new Error("Sign-in required");
  return {
    childId: session.child_id,
    role: session.role === "admin" ? "admin" : "student",
    sessionTokenHash: session.token_hash,
  };
}

/** Requires a signed-in learner before reading child-scoped practice data. */
export function requireLearnerRead(request: Request): { childId: string } {
  const session = requireSessionRead(request);
  if (session.role !== "student") throw new Error("Learner access required");
  return { childId: session.childId };
}

/** Requires a signed-in curriculum steward (the local admin role) before reads. */
export function requireAdminRead(request: Request): { childId: string } {
  const session = requireSessionRead(request);
  if (session.role !== "admin") throw new Error("Admin access required");
  return { childId: session.childId };
}

function requireSameOriginMutationProof(
  request: Request,
  allowedMethods: readonly string[],
): SessionIdentity {
  const origin = request.headers.get("origin");
  const canonicalOrigin =
    process.env.ODYSSEY_APP_ORIGIN ??
    (process.env.NODE_ENV === "production"
      ? undefined
      : new URL(request.url).origin);
  const session = activeSession(request);
  if (
    !allowedMethods.includes(request.method) ||
    !canonicalOrigin ||
    !origin ||
    origin !== canonicalOrigin ||
    !session
  ) {
    throw new Error("Mutation proof required");
  }
  return {
    childId: session.child_id,
    role: session.role === "admin" ? "admin" : "student",
    sessionTokenHash: session.token_hash,
  };
}

/** Authorizes a same-origin learning POST before it reads or changes state. */
export function requireMutationProof(request: Request): SessionIdentity {
  return requireSameOriginMutationProof(request, ["POST"]);
}

/** Authorizes an assessment mutation for a learner account only. */
export function requireLearnerMutationProof(request: Request): {
  childId: string;
  /** Server-only session binding for atomic learner mutations. */
  sessionTokenHash: string;
} {
  const proof = requireMutationProof(request);
  if (proof.role !== "student") throw new Error("Learner access required");
  return {
    childId: proof.childId,
    sessionTokenHash: proof.sessionTokenHash,
  };
}

/** Requires an admin/steward mutation to carry a canonical same-origin proof. */
export function requireAdminMutationProof(request: Request): {
  childId: string;
} {
  const proof = requireSameOriginMutationProof(request, ["POST", "DELETE"]);
  if (proof.role !== "admin") throw new Error("Admin access required");
  return { childId: proof.childId };
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

/** @deprecated Use requireAdminRead or requireAdminMutationProof by route method. */
export function requireAdmin(request: Request): { childId: string } {
  return requireAdminRead(request);
}

/** Resolves a session token to the signed-in identity. */
export function resolveSession(token: string):
  | {
      childId: string;
      username: string;
      role: "admin" | "student";
    }
  | undefined {
  if (token === "valid" && testFixturesEnabled())
    return {
      childId: "test-learner",
      username: "test-learner",
      role: "student",
    };
  const now = Date.now();
  purgeExpiredSessions(now);
  const row = readSession(token);
  if (!row) return undefined;
  const fresh = expireIfStale(row, now);
  if (!fresh) return undefined;
  learningDb
    .prepare("UPDATE auth_sessions SET last_seen = ? WHERE token_hash = ?")
    .run(now, fresh.token_hash);
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
   Persisted per-session practice state (Practice pool)
   ============================================================ */

export type SessionPool = {
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
  /** The only displayed Practice question that can be submitted. */
  activeAssignment?: { questionId: string; token: string };
};

export type SessionPoolState = { pool: SessionPool; serialized: string };

/** Stores the adaptive question pool in the session. */
export function setSessionPool(request: Request, pool: SessionPool): void {
  const session = activeSession(request);
  if (!session) return;
  learningDb
    .prepare("UPDATE auth_sessions SET question_pool = ? WHERE token_hash = ?")
    .run(JSON.stringify(pool), session.token_hash);
}

/** Returns the pool and exact serialized value needed for a conditional write. */
export function getSessionPoolState(request: Request): SessionPoolState | null {
  const session = activeSession(request);
  if (!session?.question_pool) return null;
  try {
    return {
      pool: JSON.parse(session.question_pool) as SessionPool,
      serialized: session.question_pool,
    };
  } catch {
    return null;
  }
}

/** Replaces a pool only if no other request has changed it in the meantime. */
export function compareAndSetSessionPool(
  request: Request,
  expectedSerialized: string | null,
  pool: SessionPool,
): boolean {
  const session = activeSession(request);
  if (!session) return false;
  const result = learningDb
    .prepare(
      "UPDATE auth_sessions SET question_pool = ? WHERE token_hash = ? AND question_pool IS ?",
    )
    .run(JSON.stringify(pool), session.token_hash, expectedSerialized);
  return result.changes === 1;
}

/** Creates a CSPRNG opaque token which is valid for one stored assignment. */
export function createPracticeAssignmentToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Replaces an idle Practice pool with one generated question and its opaque,
 * one-use assignment token. An existing issued assignment is never replaced.
 */
export function issueGeneratedPracticeAssignment(
  request: Request,
  question: {
    topicId: string;
    question: string;
    answer: string;
    acceptableAnswers: readonly string[];
    hint: string;
    solution: readonly string[];
    diagramSvg: string;
  },
): { assignmentToken: string } | null {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const state = getSessionPoolState(request);
    const pool = state?.pool;
    if (
      !state ||
      !pool ||
      (pool.mode ?? "practice") !== "practice" ||
      pool.topicId !== question.topicId ||
      pool.activeAssignment ||
      !Number.isInteger(pool.currentDifficulty) ||
      pool.currentDifficulty < 1 ||
      pool.currentDifficulty > 3
    )
      return null;

    const assignmentToken = createPracticeAssignmentToken();
    const questionId = `generated-${assignmentToken}`;
    const replacement: SessionPool = {
      topicId: question.topicId,
      questions: [
        {
          id: questionId,
          question: question.question,
          answer: question.answer,
          acceptableAnswers: question.acceptableAnswers,
          hint: question.hint,
          solution: question.solution,
          diagramSvg: question.diagramSvg,
          difficulty: pool.currentDifficulty,
        },
      ],
      shownIds: [questionId],
      currentDifficulty: pool.currentDifficulty,
      batchPosition: 1,
      batchSize: pool.batchSize,
      mode: "practice",
      activeAssignment: { questionId, token: assignmentToken },
    };
    if (compareAndSetSessionPool(request, state.serialized, replacement))
      return { assignmentToken };
  }
  return null;
}

/**
 * Appends a prefetched question only while space remains. The conditional write
 * prevents a stale background task from restoring an already-consumed token or
 * overwriting the persisted adaptive difficulty.
 */
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
  const state = getSessionPoolState(request);
  if (!state) return;
  const { pool } = state;
  if (
    pool.questions.length >= pool.batchSize ||
    pool.questions.some(
      (existing) => existing.id === q.id || existing.question === q.question,
    )
  )
    return;
  compareAndSetSessionPool(request, state.serialized, {
    ...pool,
    questions: [...pool.questions, q],
  });
}

/** Reads the adaptive question pool from the session. */
export function getSessionPool(request: Request): SessionPool | null {
  return getSessionPoolState(request)?.pool ?? null;
}
