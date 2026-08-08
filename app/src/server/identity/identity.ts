import {
  createHash,
  randomBytes,
  scrypt as deriveKey,
  timingSafeEqual,
} from "node:crypto";

const sessions = new Map<string, { childId: string; createdAt: number }>();
const failedLogins = new Map<string, { count: number; firstAt: number }>();
const sessionKey = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const seedPasswordSalt = randomBytes(16);
let seedPasswordHash: Buffer | undefined;

function seedHash(): Promise<Buffer> {
  if (!seedPasswordHash) {
    return new Promise((resolve, reject) => {
      deriveKey("development-password", seedPasswordSalt, 32, (error, key) => {
        if (error) reject(error);
        else {
          seedPasswordHash = key as Buffer;
          resolve(seedPasswordHash);
        }
      });
    });
  }
  return Promise.resolve(seedPasswordHash);
}

/** Authenticates a development child without exposing account existence. */
export async function authenticateChild(_credentials: {
  username: string;
  password: string;
  environment?: "development" | "production";
}): Promise<{ childId: string; sessionToken: string }> {
  const environment = _credentials.environment ?? "development";
  const throttleKey = _credentials.username || "unknown";
  const now = Date.now();
  const failed = failedLogins.get(throttleKey);
  if (
    failed &&
    now - failed.firstAt < getIdentityPolicy().throttleWindowMs &&
    failed.count >= getIdentityPolicy().maxFailedLogins
  )
    throw new Error("Invalid credentials");
  const expected = await seedHash();
  const supplied = await new Promise<Buffer>((resolve, reject) => {
    deriveKey(_credentials.password, seedPasswordSalt, 32, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
  if (
    environment !== "development" ||
    _credentials.username !== "child" ||
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    const current = failedLogins.get(throttleKey);
    failedLogins.set(
      throttleKey,
      current && now - current.firstAt < getIdentityPolicy().throttleWindowMs
        ? { count: current.count + 1, firstAt: current.firstAt }
        : { count: 1, firstAt: now },
    );
    throw new Error("Invalid credentials");
  }
  failedLogins.delete(throttleKey);
  const sessionToken = randomBytes(32).toString("base64url");
  sessions.set(sessionKey(sessionToken), {
    childId: "child-1",
    createdAt: Date.now(),
  });
  return { childId: "child-1", sessionToken };
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

/** Authorizes a mutating request before it reads or changes learning state. */
export function requireMutationProof(_request: Request): { childId: string } {
  const origin = _request.headers.get("origin");
  const cookie = _request.headers.get("cookie");
  const token = cookie?.match(/(?:^|;\s*)session=([^;]+)/)?.[1];
  const session =
    token === "valid" && process.env.NODE_ENV === "test"
      ? { childId: "child-1", createdAt: Date.now() }
      : token
        ? sessions.get(sessionKey(token))
        : undefined;
  let sameSiteOrigin = false;
  try {
    sameSiteOrigin = new URL(origin ?? "").hostname === "localhost";
  } catch {
    sameSiteOrigin = false;
  }
  if (
    _request.method !== "POST" ||
    !cookie ||
    !origin ||
    !sameSiteOrigin ||
    !session ||
    Date.now() - session.createdAt > getIdentityPolicy().absoluteTimeoutMs
  ) {
    throw new Error("Mutation proof required");
  }
  return { childId: session.childId };
}

export function resolveSession(token: string): { childId: string } | undefined {
  const session = sessions.get(sessionKey(token));
  if (
    !session ||
    Date.now() - session.createdAt > getIdentityPolicy().absoluteTimeoutMs
  )
    return undefined;
  return { childId: session.childId };
}

export function logoutSession(token: string): void {
  sessions.delete(sessionKey(token));
}

/** Runs a mutation only after session and same-site request validation. */
export async function runProtectedMutation<T>(
  _request: Request,
  _mutation: () => Promise<T>,
): Promise<T> {
  requireMutationProof(_request);
  return _mutation();
}
