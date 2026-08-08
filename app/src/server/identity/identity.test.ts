import { expect, test } from "vitest";
import {
  assertChildRecordScope,
  authenticateChild,
  getIdentityPolicy,
  requireMutationProof,
  runProtectedMutation,
  logoutSession,
  resolveSession,
} from "./identity";

// STUB: AC2

test("STUB: AC2 creates a rotated session for the local seeded child", async () => {
  await expect(
    authenticateChild({ username: "child", password: "development-password" }),
  ).resolves.toEqual({
    childId: expect.any(String),
    sessionToken: expect.any(String),
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

test("STUB: AC2 refuses the development seed outside local development", async () => {
  await expect(
    authenticateChild({
      username: "child",
      password: "development-password",
      environment: "production",
    }),
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
    username: "child",
    password: "development-password",
  });
  expect(resolveSession(session.sessionToken)).toEqual({ childId: "child-1" });
  logoutSession(session.sessionToken);
  expect(resolveSession(session.sessionToken)).toBeUndefined();
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
      password: "development-password",
    }),
  ).rejects.toThrow("Invalid credentials");
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
