import {
  createHash,
  randomBytes,
  scrypt as deriveKey,
  timingSafeEqual,
} from "node:crypto";
import { cancelSuggestionsForChild } from "../learning/parent-suggestions";
import { learningDb } from "../learning/sqlite-repository";
import type { LearnerQuestionInteraction } from "../learning/question-interactions";

/** Distinct server-side authorization roles. */
export type AccountRole = "admin" | "parent" | "student";

function parseAccountRole(role: string): AccountRole {
  if (role === "admin" || role === "parent" || role === "student") return role;
  throw new Error("Invalid account role");
}

/** One provisioned account with an immutable principal ID. */
type AccountRow = {
  account_id: string;
  username: string;
  password_hash: Buffer;
  salt: Buffer;
  role: string;
};

/** Session row persisted in SQLite so sign-ins survive restarts. */
type SessionRow = {
  token_hash: string;
  principal_id: string | null;
  child_id: string;
  username: string;
  role: string;
  created_at: number;
  last_seen: number;
  generated_requests: number;
  allowance_topic: string | null;
  question_pool: string | null;
};

type SeedAccount = {
  username: string;
  password: string;
  role: AccountRole;
  childId: string;
};

/**
 * Generic accounts used only for local verification. They are opt-in in
 * development and separately enabled by Vitest; production never seeds or
 * accepts either account.
 */
const DEVELOPMENT_FIXTURE_ACCOUNTS: readonly SeedAccount[] = [
  {
    username: "devadmin",
    password: "admin",
    role: "admin",
    childId: "devadmin",
  },
  {
    username: "devparent",
    password: "parent",
    role: "parent",
    childId: "",
  },
  {
    username: "devstu",
    password: "stu",
    role: "student",
    childId: "devstu",
  },
];

const TEST_FIXTURE_ACCOUNTS: readonly SeedAccount[] = [
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

function fixtureAccounts(): readonly SeedAccount[] {
  if (testFixturesEnabled()) return TEST_FIXTURE_ACCOUNTS;
  if (
    process.env.NODE_ENV === "development" &&
    process.env.ODYSSEY_ENABLE_DEVELOPMENT_FIXTURE_ACCOUNTS === "1"
  )
    return DEVELOPMENT_FIXTURE_ACCOUNTS;
  return [];
}

/**
 * Resolves the learner scope key under which a student's practice data is
 * stored: the seeded fixture child id when one applies, else
 * `child:<username>`. Sign-in and every parent-facing aggregation must
 * derive this the same way.
 */
export function learnerScopeKeyForUsername(username: string): string {
  const seeded = fixtureAccounts().find(
    (account) => account.username === username,
  );
  return seeded?.childId ?? `child:${username}`;
}

/**
 * Reads one explicitly configured first-parent bootstrap. Production requires
 * its own opt-in flag; the seed is later suppressed once any parent exists.
 */
function configuredParentBootstrapAccount(): SeedAccount | null {
  const production = process.env.NODE_ENV === "production";
  const enabled = production
    ? process.env.ODYSSEY_ENABLE_PRODUCTION_PARENT_BOOTSTRAP === "1"
    : process.env.NODE_ENV === "development" &&
      process.env.ODYSSEY_ENABLE_LOCAL_PARENT_BOOTSTRAP === "1";
  if (!enabled) return null;
  const username = process.env.ODYSSEY_PARENT_BOOTSTRAP_USERNAME?.trim();
  const password = process.env.ODYSSEY_PARENT_BOOTSTRAP_PASSWORD;
  if (!username || !password)
    throw new Error("Parent bootstrap credentials are incomplete");
  if (
    !/^[a-zA-Z0-9_.-]{3,64}$/.test(username) ||
    password.length < 8 ||
    password.length > 256
  )
    throw new Error("Parent bootstrap credentials are invalid");
  return { username, password, role: "parent", childId: "" };
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

/** Seeds optional fixture accounts; existing rows are never overwritten. */
async function seedFixtureAccounts(): Promise<void> {
  const accounts = fixtureAccounts();
  if (accounts.length === 0) return;
  const existing = learningDb
    .prepare("SELECT username FROM accounts")
    .all() as Array<{ username: string }>;
  const have = new Set(existing.map((account) => account.username));
  const insert = learningDb.prepare(
    "INSERT INTO accounts (account_id, username, password_hash, salt, role) VALUES (?, ?, ?, ?, ?) ON CONFLICT(username) DO NOTHING",
  );
  for (const account of accounts) {
    if (have.has(account.username)) continue;
    const salt = randomBytes(16);
    const hash = await scryptSync(account.password, salt);
    insert.run(
      randomBytes(16).toString("hex"),
      account.username,
      hash,
      salt,
      account.role,
    );
  }
}

/** Seeds one configured first parent under a database write lock. */
async function seedConfiguredParentBootstrap(): Promise<void> {
  const account = configuredParentBootstrapAccount();
  if (!account) return;
  const salt = randomBytes(16);
  const passwordHash = await scryptSync(account.password, salt);
  learningDb.exec("BEGIN IMMEDIATE");
  try {
    const parentExists = learningDb
      .prepare(
        "SELECT 1 AS parent_exists FROM accounts WHERE role = 'parent' LIMIT 1",
      )
      .get() as { parent_exists: number } | undefined;
    if (parentExists) {
      learningDb.exec("COMMIT");
      return;
    }
    const existing = learningDb
      .prepare("SELECT role FROM accounts WHERE username = ?")
      .get(account.username) as { role: string } | undefined;
    if (existing)
      throw new Error("Parent bootstrap username is already provisioned");
    learningDb
      .prepare(
        "INSERT INTO accounts (account_id, username, password_hash, salt, role) VALUES (?, ?, ?, ?, 'parent')",
      )
      .run(
        randomBytes(16).toString("hex"),
        account.username,
        passwordHash,
        salt,
      );
    learningDb.exec("COMMIT");
  } catch (error) {
    learningDb.exec("ROLLBACK");
    throw error;
  }
}

/** Seeds explicitly enabled fixture and first-parent bootstrap accounts. */
async function seedAccounts(): Promise<void> {
  // Bootstrap first: explicitly configured credentials must win over the
  // zero-parents guard that the devparent fixture would otherwise trip.
  await seedConfiguredParentBootstrap();
  await seedFixtureAccounts();
}

const seedPromise = seedAccounts();

function findAccount(username: string): AccountRow | undefined {
  return learningDb
    .prepare(
      "SELECT account_id, username, password_hash, salt, role FROM accounts WHERE username = ?",
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
  role: AccountRole;
  principalId: string;
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

  const role = parseAccountRole(account.role);
  const seededAccount = [
    ...fixtureAccounts(),
    ...(configuredParentBootstrapAccount()
      ? [configuredParentBootstrapAccount()!]
      : []),
  ].find((candidate) => candidate.username === username);
  const childId =
    seededAccount?.childId ?? learnerScopeKeyForUsername(username);

  // Rotate: one active session per account.
  learningDb
    .prepare("DELETE FROM auth_sessions WHERE username = ?")
    .run(username);

  const sessionToken = randomBytes(32).toString("base64url");
  const issuedAt = Date.now();
  learningDb
    .prepare(
      `INSERT INTO auth_sessions
        (token_hash, principal_id, child_id, username, role, created_at, last_seen, generated_requests)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    )
    .run(
      sessionKey(sessionToken),
      account.account_id,
      childId,
      username,
      role,
      issuedAt,
      issuedAt,
    );

  return {
    childId,
    sessionToken,
    username,
    role,
    principalId: account.account_id,
  };
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
      principal_id: "test-learner",
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
  /** Immutable authenticated account identity; never a learner scope. */
  principalId: string;
  childId: string;
  role: AccountRole;
  /** Server-only binding used by atomic session-owned learning mutations. */
  sessionTokenHash: string;
};

function sessionIdentity(session: SessionRow): SessionIdentity {
  if (!session.principal_id) throw new Error("Invalid session principal");
  return {
    principalId: session.principal_id,
    childId: session.child_id,
    role: parseAccountRole(session.role),
    sessionTokenHash: session.token_hash,
  };
}

function requireSessionRead(request: Request): SessionIdentity {
  const session = activeSession(request);
  if (!session) throw new Error("Sign-in required");
  return sessionIdentity(session);
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

/** Requires the authenticated parent principal, never a client-selected child. */
export function requireParentRead(request: Request): {
  parentAccountId: string;
} {
  const session = requireSessionRead(request);
  if (session.role !== "parent") throw new Error("Parent access required");
  return { parentAccountId: session.principalId };
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
  return sessionIdentity(session);
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
  const proof = requireSameOriginMutationProof(request, [
    "POST",
    "PATCH",
    "DELETE",
  ]);
  if (proof.role !== "admin") throw new Error("Admin access required");
  return { childId: proof.childId };
}

/** Requires a same-origin parent lifecycle mutation. */
export function requireParentMutationProof(request: Request): {
  parentAccountId: string;
} {
  const proof = requireSameOriginMutationProof(request, [
    "POST",
    "PATCH",
    "DELETE",
  ]);
  if (proof.role !== "parent") throw new Error("Parent access required");
  return { parentAccountId: proof.principalId };
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
      principalId: string;
      childId: string;
      username: string;
      role: AccountRole;
    }
  | undefined {
  if (token === "valid" && testFixturesEnabled())
    return {
      principalId: "test-learner",
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
  if (!fresh.principal_id) return undefined;
  return {
    principalId: fresh.principal_id,
    childId: fresh.child_id,
    username: fresh.username,
    role: parseAccountRole(fresh.role),
  };
}

/** Provider-neutral subject supplied by a future verified SSO adapter. */
export type ExternalIdentitySubject = {
  provider: string;
  subject: string;
};

/**
 * Resolves a verified provider subject to an Odyssey principal. This performs
 * no token verification and deliberately does not issue a session: a future
 * provider adapter must establish that trust boundary before calling it.
 */
export function resolveExternalIdentitySubject(
  identity: ExternalIdentitySubject,
): { principalId: string; username: string; role: AccountRole } | undefined {
  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(identity.provider) ||
    identity.subject.length === 0 ||
    identity.subject.length > 256
  )
    return undefined;
  const row = learningDb
    .prepare(
      `SELECT accounts.account_id AS account_id, accounts.username AS username, accounts.role AS role
       FROM external_identity_links
       JOIN accounts ON accounts.account_id = external_identity_links.account_id
       WHERE external_identity_links.provider = ?
         AND external_identity_links.provider_subject = ?`,
    )
    .get(identity.provider, identity.subject) as
    | { account_id: string; username: string; role: string }
    | undefined;
  if (!row) return undefined;
  return {
    principalId: row.account_id,
    username: row.username,
    role: parseAccountRole(row.role),
  };
}

type AccountCredentials = { username: string; password: string };

function validateAccountCredentials(
  credentials: AccountCredentials,
  label: "Child" | "Parent",
): void {
  if (!/^[a-zA-Z0-9_.-]{3,64}$/.test(credentials.username))
    throw new Error(`${label} username is invalid`);
  if (credentials.password.length < 8 || credentials.password.length > 256)
    throw new Error(`${label} password is invalid`);
}

function requireActiveParentChildLink(
  parentAccountId: string,
  childAccountId: string,
): void {
  const link = learningDb
    .prepare(
      `SELECT 1 FROM parent_child_links
       WHERE parent_account_id = ? AND child_account_id = ? AND revoked_at IS NULL`,
    )
    .get(parentAccountId, childAccountId);
  if (!link) throw new Error("Child access denied");
}

/** Writes a minimal local lifecycle record within the caller's transaction. */
function recordParentRelationshipEvent(
  parentAccountId: string,
  childAccountId: string,
  eventType: "child-created" | "password-reset" | "link-revoked",
  reason: "parent-requested" | null,
  createdAt: number,
): void {
  learningDb
    .prepare(
      `INSERT INTO parent_relationship_events
        (parent_account_id, child_account_id, event_type, reason, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(parentAccountId, childAccountId, eventType, reason, createdAt);
}

/** Creates a linked learner account without exposing a client-selected parent. */
export async function createParentChildAccount(
  parentAccountId: string,
  credentials: AccountCredentials,
): Promise<{ accountId: string; username: string }> {
  validateAccountCredentials(credentials, "Child");
  const salt = randomBytes(16);
  const passwordHash = await scryptSync(credentials.password, salt);
  const accountId = randomBytes(16).toString("hex");
  const now = Date.now();
  learningDb.exec("BEGIN IMMEDIATE");
  try {
    const parent = learningDb
      .prepare("SELECT role FROM accounts WHERE account_id = ?")
      .get(parentAccountId) as { role: string } | undefined;
    if (!parent || parseAccountRole(parent.role) !== "parent")
      throw new Error("Parent access denied");
    learningDb
      .prepare(
        `INSERT INTO accounts (account_id, username, password_hash, salt, role)
         VALUES (?, ?, ?, ?, 'student')`,
      )
      .run(accountId, credentials.username, passwordHash, salt);
    learningDb
      .prepare(
        `INSERT INTO parent_child_links
          (parent_account_id, child_account_id, created_at)
         VALUES (?, ?, ?)`,
      )
      .run(parentAccountId, accountId, now);
    recordParentRelationshipEvent(
      parentAccountId,
      accountId,
      "child-created",
      "parent-requested",
      now,
    );
    learningDb.exec("COMMIT");
  } catch (error) {
    learningDb.exec("ROLLBACK");
    if (String(error).includes("UNIQUE constraint failed: accounts.username"))
      throw new Error("Child username is unavailable");
    throw error;
  }
  return { accountId, username: credentials.username };
}

/** Lists only active child accounts linked to the authenticated parent. */
export function listParentChildren(parentAccountId: string): Array<{
  accountId: string;
  username: string;
}> {
  return learningDb
    .prepare(
      `SELECT accounts.account_id AS accountId, accounts.username AS username
       FROM parent_child_links
       JOIN accounts ON accounts.account_id = parent_child_links.child_account_id
       WHERE parent_child_links.parent_account_id = ?
         AND parent_child_links.revoked_at IS NULL
         AND accounts.role = 'student'
       ORDER BY accounts.username`,
    )
    .all(parentAccountId) as Array<{ accountId: string; username: string }>;
}

/** Resets a linked child's local password and invalidates all of that child's sessions. */
export async function resetParentChildPassword(
  parentAccountId: string,
  childAccountId: string,
  password: string,
): Promise<void> {
  validateAccountCredentials({ username: "child", password }, "Child");
  const salt = randomBytes(16);
  const passwordHash = await scryptSync(password, salt);
  learningDb.exec("BEGIN IMMEDIATE");
  try {
    requireActiveParentChildLink(parentAccountId, childAccountId);
    const child = learningDb
      .prepare(
        "SELECT username FROM accounts WHERE account_id = ? AND role = 'student'",
      )
      .get(childAccountId) as { username: string } | undefined;
    if (!child) throw new Error("Child access denied");
    learningDb
      .prepare(
        "UPDATE accounts SET password_hash = ?, salt = ? WHERE account_id = ?",
      )
      .run(passwordHash, salt, childAccountId);
    learningDb
      .prepare("DELETE FROM auth_sessions WHERE username = ?")
      .run(child.username);
    recordParentRelationshipEvent(
      parentAccountId,
      childAccountId,
      "password-reset",
      null,
      Date.now(),
    );
    learningDb.exec("COMMIT");
  } catch (error) {
    learningDb.exec("ROLLBACK");
    throw error;
  }
}

/** Revokes parent access and invalidates the parent's existing sessions. */
export function revokeParentChildLink(
  parentAccountId: string,
  childAccountId: string,
): void {
  learningDb.exec("BEGIN IMMEDIATE");
  try {
    requireActiveParentChildLink(parentAccountId, childAccountId);
    learningDb
      .prepare(
        `UPDATE parent_child_links SET revoked_at = ?
         WHERE parent_account_id = ? AND child_account_id = ? AND revoked_at IS NULL`,
      )
      .run(Date.now(), parentAccountId, childAccountId);
    recordParentRelationshipEvent(
      parentAccountId,
      childAccountId,
      "link-revoked",
      "parent-requested",
      Date.now(),
    );
    // Same transaction as the revoke: any active practice suggestion for
    // this child dies with the link (audited before commit).
    const revokedUsername = (
      learningDb
        .prepare("SELECT username FROM accounts WHERE account_id = ?")
        .get(childAccountId) as { username: string } | undefined
    )?.username;
    if (revokedUsername)
      cancelSuggestionsForChild(
        parentAccountId,
        learnerScopeKeyForUsername(revokedUsername),
      );
    learningDb.exec("COMMIT");
  } catch (error) {
    learningDb.exec("ROLLBACK");
    throw error;
  }
  // Parent sessions remain valid for other linked children. Every child-scoped
  // operation rechecks this link, so stale tabs lose only the revoked scope.
}

/** Lists every parent account with its active children usernames. */
export function listParentAccounts(): Array<{
  accountId: string;
  username: string;
  children: Array<{ username: string }>;
}> {
  const parents = learningDb
    .prepare(
      `SELECT account_id AS accountId, username FROM accounts
       WHERE role = 'parent' ORDER BY username`,
    )
    .all() as Array<{ accountId: string; username: string }>;
  return parents.map((parent) => ({
    ...parent,
    children: listParentChildren(parent.accountId).map((child) => ({
      username: child.username,
    })),
  }));
}

/** Creates a parent account for admin use; no link row, no audit event. */
export async function createParentAccount(
  credentials: AccountCredentials,
): Promise<{ accountId: string; username: string }> {
  validateAccountCredentials(credentials, "Parent");
  const salt = randomBytes(16);
  const passwordHash = await scryptSync(credentials.password, salt);
  const accountId = randomBytes(16).toString("hex");
  learningDb.exec("BEGIN IMMEDIATE");
  try {
    learningDb
      .prepare(
        `INSERT INTO accounts (account_id, username, password_hash, salt, role)
         VALUES (?, ?, ?, ?, 'parent')`,
      )
      .run(accountId, credentials.username, passwordHash, salt);
    learningDb.exec("COMMIT");
  } catch (error) {
    learningDb.exec("ROLLBACK");
    if (String(error).includes("UNIQUE constraint failed: accounts.username"))
      throw new Error("Parent username is unavailable");
    throw error;
  }
  return { accountId, username: credentials.username };
}

/** Resets a parent's password and invalidates all of that parent's sessions. */
export async function resetParentAccountPassword(
  parentAccountId: string,
  password: string,
): Promise<void> {
  validateAccountCredentials({ username: "parent", password }, "Parent");
  const salt = randomBytes(16);
  const passwordHash = await scryptSync(password, salt);
  learningDb.exec("BEGIN IMMEDIATE");
  try {
    const parent = learningDb
      .prepare(
        "SELECT username FROM accounts WHERE account_id = ? AND role = 'parent'",
      )
      .get(parentAccountId) as { username: string } | undefined;
    if (!parent) throw new Error("Parent access denied");
    learningDb
      .prepare(
        "UPDATE accounts SET password_hash = ?, salt = ? WHERE account_id = ?",
      )
      .run(passwordHash, salt, parentAccountId);
    learningDb
      .prepare("DELETE FROM auth_sessions WHERE username = ?")
      .run(parent.username);
    learningDb.exec("COMMIT");
  } catch (error) {
    learningDb.exec("ROLLBACK");
    throw error;
  }
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
    interaction?: LearnerQuestionInteraction;
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
    interaction: LearnerQuestionInteraction;
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
          interaction: question.interaction,
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
    interaction?: LearnerQuestionInteraction;
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
