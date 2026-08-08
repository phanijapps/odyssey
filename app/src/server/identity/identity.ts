/** Authenticates a development child without exposing account existence. */
export async function authenticateChild(
  _credentials: { username: string; password: string; environment?: "development" | "production" },
): Promise<{ childId: string; sessionToken: string }> {
  throw new Error("STUB: implement child authentication");
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
  throw new Error("STUB: define identity policy");
}

/** Ensures a requested child-owned record belongs to the signed-in child. */
export function assertChildRecordScope(_sessionChildId: string, _recordChildId: string): void {
  throw new Error("STUB: implement child record authorization");
}

/** Authorizes a mutating request before it reads or changes learning state. */
export function requireMutationProof(_request: Request): { childId: string } {
  throw new Error("STUB: implement same-site mutation proof");
}

/** Runs a mutation only after session and same-site request validation. */
export async function runProtectedMutation<T>(
  _request: Request,
  _mutation: () => Promise<T>,
): Promise<T> {
  throw new Error("STUB: guard mutation before state access");
}
