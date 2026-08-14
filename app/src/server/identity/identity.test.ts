import { afterEach, expect, test, vi } from "vitest";
import {
  assertChildRecordScope,
  authenticateChild,
  consumeGeneratedPracticeAllowance,
  grantGeneratedPracticeAllowance,
  getIdentityPolicy,
  requireMutationProof,
  runProtectedMutation,
  logoutSession,
  resolveSession,
} from "./identity";

afterEach(() => vi.useRealTimers());

// STUB: AC2

test("STUB: AC2 creates a rotated session for the local seeded child", async () => {
  await expect(
    authenticateChild({ username: "demo", password: "demo" }),
  ).resolves.toEqual({
    childId: expect.any(String),
    sessionToken: expect.any(String),
    username: expect.any(String),
    role: expect.any(String),
  });
});

test("STUB: AC2 returns one generic rejection for invalid credentials", async () => {
  await expect(
    authenticateChild({
      username: "unknown",
      password: "wrong",
      environment: "development",
    }),
  ).rejects.toThrow("Invalid credentials");
});

test("authenticates each provisioned account with its own identity", async () => {
  const student = await authenticateChild({
    username: "sushma",
    password: "Mason712048",
  });
  expect(student.role).toBe("student");
  expect(student.username).toBe("sushma");

  const admin = await authenticateChild({
    username: "admin",
    password: "admin",
  });
  expect(admin.role).toBe("admin");
  expect(admin.childId).toBe("admin");

  await expect(
    authenticateChild({ username: "sushma", password: "wrong" }),
  ).rejects.toThrow("Invalid credentials");
});

test("STUB: AC2 configures the password, session, throttling, and cookie controls", () => {
  expect(getIdentityPolicy()).toEqual({
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
  });
});

// STUB: AC5
test("STUB: AC5 rejects access to another child's records", () => {
  expect(() => assertChildRecordScope("child-1", "child-2")).toThrow();
});

// STUB: AC6
test("STUB: AC6 rejects a mutation without a same-site anti-forgery proof", () => {
  expect(() =>
    requireMutationProof(new Request("http://localhost/answer")),
  ).toThrow();
});

test("STUB: AC6 permits a same-site mutation only after validation", async () => {
  await expect(
    runProtectedMutation(
      new Request("http://localhost/answer", {
        method: "POST",
        headers: { cookie: "session=valid", origin: "http://localhost" },
      }),
      async () => "persisted",
    ),
  ).resolves.toBe("persisted");
});

test("enforces the generated-practice session cap before an eleventh request", async () => {
  const session = await authenticateChild({
    username: "demo",
    password: "demo",
  });
  const request = new Request("http://localhost/generated-practice", {
    method: "POST",
    headers: {
      cookie: `session=${session.sessionToken}`,
      origin: "http://localhost",
    },
  });
  for (let index = 0; index < 10; index += 1) {
    grantGeneratedPracticeAllowance(request, "ratio");
    expect(consumeGeneratedPracticeAllowance(request, "ratio")).toEqual({
      childId: "child-1",
    });
  }
  grantGeneratedPracticeAllowance(request, "ratio");
  expect(() => consumeGeneratedPracticeAllowance(request, "ratio")).toThrow(
    "Generated practice allowance required",
  );
});

test("STUB: AC6 rejects cross-site mutations before running their side effect", async () => {
  let mutationRan = false;

  await expect(
    runProtectedMutation(
      new Request("http://localhost/answer", {
        method: "POST",
        headers: { cookie: "session=valid", origin: "https://example.invalid" },
      }),
      async () => {
        mutationRan = true;
        return "persisted";
      },
    ),
  ).rejects.toThrow();

  expect(mutationRan).toBe(false);
});

test("logout invalidates the issued session token", async () => {
  const session = await authenticateChild({
    username: "demo",
    password: "demo",
  });
  expect(resolveSession(session.sessionToken)).toMatchObject({
    childId: "child-1",
  });
  logoutSession(session.sessionToken);
  expect(resolveSession(session.sessionToken)).toBeUndefined();
});

test("rotates an existing child session on a new login", async () => {
  const first = await authenticateChild({
    username: "demo",
    password: "demo",
  });
  const second = await authenticateChild({
    username: "demo",
    password: "demo",
  });

  expect(second.sessionToken).not.toBe(first.sessionToken);
  expect(resolveSession(first.sessionToken)).toBeUndefined();
  expect(resolveSession(second.sessionToken)).toMatchObject({
    childId: "child-1",
  });
});

test("expires sessions after the idle timeout", async () => {
  const idleSession = await authenticateChild({
    username: "demo",
    password: "demo",
  });
  vi.useFakeTimers();
  vi.setSystemTime(Date.now() + getIdentityPolicy().idleTimeoutMs + 1);
  expect(resolveSession(idleSession.sessionToken)).toBeUndefined();
});

test("expires an active session at the absolute timeout", async () => {
  const absoluteSession = await authenticateChild({
    username: "demo",
    password: "demo",
  });
  const start = Date.now();
  const policy = getIdentityPolicy();
  vi.useFakeTimers();
  for (
    let elapsed = policy.idleTimeoutMs - 1;
    elapsed < policy.absoluteTimeoutMs - 1;
    elapsed += policy.idleTimeoutMs - 1
  ) {
    vi.setSystemTime(start + elapsed);
    expect(resolveSession(absoluteSession.sessionToken)).toMatchObject({
      childId: "child-1",
    });
  }
  vi.setSystemTime(start + policy.absoluteTimeoutMs + 1);
  expect(resolveSession(absoluteSession.sessionToken)).toBeUndefined();
});

test("throttles repeated failed logins", async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await expect(
      authenticateChild({ username: "throttle-user", password: "wrong" }),
    ).rejects.toThrow("Invalid credentials");
  }
  await expect(
    authenticateChild({
      username: "throttle-user",
      password: "demo",
    }),
  ).rejects.toThrow("Invalid credentials");
});

test("allows a correct sign-in after the throttle window expires", async () => {
  const username = "demo";
  for (
    let attempt = 0;
    attempt < getIdentityPolicy().maxFailedLogins;
    attempt += 1
  ) {
    await expect(
      authenticateChild({ username, password: "wrong" }),
    ).rejects.toThrow("Invalid credentials");
  }
  await expect(
    authenticateChild({ username, password: "demo" }),
  ).rejects.toThrow("Invalid credentials");

  vi.useFakeTimers();
  vi.setSystemTime(Date.now() + getIdentityPolicy().throttleWindowMs + 1);
  await expect(
    authenticateChild({ username, password: "demo" }),
  ).resolves.toMatchObject({ childId: "child-1" });
});

test("STUB: AC6 rejects a cookie-authenticated POST with no Origin or CSRF token before state access", async () => {
  let mutationRan = false;

  await expect(
    runProtectedMutation(
      new Request("http://localhost/answer", {
        method: "POST",
        headers: { cookie: "session=valid" },
      }),
      async () => {
        mutationRan = true;
        return "persisted";
      },
    ),
  ).rejects.toThrow();

  expect(mutationRan).toBe(false);
});
