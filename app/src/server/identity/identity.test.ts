import { afterEach, expect, test, vi } from "vitest";
import {
  appendSessionPoolQuestion,
  assertChildRecordScope,
  authenticateChild,
  consumeGeneratedPracticeAllowance,
  grantGeneratedPracticeAllowance,
  getIdentityPolicy,
  getSessionPool,
  learnerScopeKeyForUsername,
  requireAdminMutationProof,
  requireAdminRead,
  requireLearnerRead,
  requireMutationProof,
  requireLearnerMutationProof,
  runProtectedMutation,
  logoutSession,
  purgeExpiredSessions,
  resolveSession,
  setSessionPool,
} from "./identity";

afterEach(() => vi.useRealTimers());

test("learner scope keys match the fixture childId or derive from the username", () => {
  // The vitest fixture set is active in this environment.
  expect(learnerScopeKeyForUsername("test-learner")).toBe("test-learner");
  expect(learnerScopeKeyForUsername("made-up-user")).toBe("child:made-up-user");
});

// STUB: AC2

test("STUB: AC2 creates a rotated session for the local seeded child", async () => {
  await expect(
    authenticateChild({
      username: "test-learner",
      password: "test-learner-password",
    }),
  ).resolves.toEqual({
    principalId: expect.any(String),
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

test("rejects generic fixture credentials when production is selected", async () => {
  await expect(
    authenticateChild({
      username: "test-learner",
      password: "test-learner-password",
      environment: "production",
    }),
  ).rejects.toThrow("Invalid credentials");
});

test("authenticates each provisioned account with its own identity", async () => {
  const student = await authenticateChild({
    username: "test-learner",
    password: "test-learner-password",
  });
  expect(student.role).toBe("student");
  expect(student.username).toBe("test-learner");

  const admin = await authenticateChild({
    username: "test-admin",
    password: "test-admin-password",
  });
  expect(admin.role).toBe("admin");
  expect(admin.childId).toBe("test-admin");

  await expect(
    authenticateChild({ username: "test-learner", password: "wrong" }),
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
    username: "test-learner",
    password: "test-learner-password",
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
      childId: "test-learner",
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
    username: "test-learner",
    password: "test-learner-password",
  });
  expect(resolveSession(session.sessionToken)).toMatchObject({
    childId: "test-learner",
  });
  logoutSession(session.sessionToken);
  expect(resolveSession(session.sessionToken)).toBeUndefined();
});

test("rotates an existing child session on a new login", async () => {
  const first = await authenticateChild({
    username: "test-learner",
    password: "test-learner-password",
  });
  const second = await authenticateChild({
    username: "test-learner",
    password: "test-learner-password",
  });

  expect(second.sessionToken).not.toBe(first.sessionToken);
  expect(resolveSession(first.sessionToken)).toBeUndefined();
  expect(resolveSession(second.sessionToken)).toMatchObject({
    childId: "test-learner",
  });
});

test("expires sessions after the idle timeout", async () => {
  const idleSession = await authenticateChild({
    username: "test-learner",
    password: "test-learner-password",
  });
  vi.useFakeTimers();
  vi.setSystemTime(Date.now() + getIdentityPolicy().idleTimeoutMs + 1);
  expect(resolveSession(idleSession.sessionToken)).toBeUndefined();
});

test("opportunistically purges expired sessions and their persisted question pool", async () => {
  const session = await authenticateChild({
    username: "test-learner",
    password: "test-learner-password",
  });
  const request = new Request("http://localhost/api/progress", {
    headers: { cookie: `session=${session.sessionToken}` },
  });
  setSessionPool(request, {
    topicId: "retention",
    questions: [],
    shownIds: [],
    currentDifficulty: 1,
    batchPosition: 0,
    batchSize: 1,
    activeAssignment: { questionId: "retention-question", token: "secret" },
  });

  const expiresAt = Date.now() + getIdentityPolicy().idleTimeoutMs + 1;
  vi.useFakeTimers();
  vi.setSystemTime(expiresAt);

  expect(purgeExpiredSessions()).toBeGreaterThan(0);
  expect(resolveSession(session.sessionToken)).toBeUndefined();
  expect(getSessionPool(request)).toBeNull();
});

test("expires an active session at the absolute timeout", async () => {
  // Freeze issuance time before authentication. Starting the clock after an
  // asynchronous password hash can otherwise exceed the idle boundary by a
  // few real milliseconds and make this absolute-timeout test flaky.
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  const absoluteSession = await authenticateChild({
    username: "test-learner",
    password: "test-learner-password",
  });
  const start = Date.now();
  const policy = getIdentityPolicy();
  for (
    let elapsed = policy.idleTimeoutMs - 1;
    elapsed < policy.absoluteTimeoutMs - 1;
    elapsed += policy.idleTimeoutMs - 1
  ) {
    vi.setSystemTime(start + elapsed);
    expect(
      resolveSession(absoluteSession.sessionToken),
      `elapsed=${elapsed}`,
    ).toMatchObject({
      childId: "test-learner",
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
      password: "test-learner-password",
    }),
  ).rejects.toThrow("Invalid credentials");
});

test("allows a correct sign-in after the throttle window expires", async () => {
  const username = "test-learner";
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
    authenticateChild({ username, password: "test-learner-password" }),
  ).rejects.toThrow("Invalid credentials");

  vi.useFakeTimers();
  vi.setSystemTime(Date.now() + getIdentityPolicy().throttleWindowMs + 1);
  await expect(
    authenticateChild({ username, password: "test-learner-password" }),
  ).resolves.toMatchObject({ childId: "test-learner" });
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

test("rejects a same-host but cross-port mutation origin", () => {
  expect(() =>
    requireMutationProof(
      new Request("http://localhost:3000/answer", {
        method: "POST",
        headers: { cookie: "session=valid", origin: "http://localhost:3001" },
      }),
    ),
  ).toThrow("Mutation proof required");
});

test("rejects an admin from learner-only mutations", async () => {
  const session = await authenticateChild({
    username: "test-admin",
    password: "test-admin-password",
  });
  expect(() =>
    requireLearnerMutationProof(
      new Request("http://localhost/assessment", {
        method: "POST",
        headers: {
          cookie: `session=${session.sessionToken}`,
          origin: "http://localhost",
        },
      }),
    ),
  ).toThrow("Learner access required");
});

test("scopes reads by role and admin mutations by canonical origin", async () => {
  const learner = await authenticateChild({
    username: "test-learner",
    password: "test-learner-password",
  });
  const admin = await authenticateChild({
    username: "test-admin",
    password: "test-admin-password",
  });

  expect(() =>
    requireAdminRead(
      new Request("http://localhost", {
        headers: { cookie: `session=${learner.sessionToken}` },
      }),
    ),
  ).toThrow("Admin access required");
  expect(() =>
    requireLearnerRead(
      new Request("http://localhost", {
        headers: { cookie: `session=${admin.sessionToken}` },
      }),
    ),
  ).toThrow("Learner access required");
  expect(() =>
    requireAdminMutationProof(
      new Request("http://localhost", {
        method: "DELETE",
        headers: {
          cookie: `session=${admin.sessionToken}`,
          origin: "https://example.invalid",
        },
      }),
    ),
  ).toThrow("Mutation proof required");
  expect(
    requireAdminMutationProof(
      new Request("http://localhost", {
        method: "DELETE",
        headers: {
          cookie: `session=${admin.sessionToken}`,
          origin: "http://localhost",
        },
      }),
    ),
  ).toEqual({ childId: "test-admin" });
});

test("caps and deduplicates a prefetched Practice pool", async () => {
  const session = await authenticateChild({
    username: "test-learner",
    password: "test-learner-password",
  });
  const request = new Request("http://localhost/api/progress", {
    headers: { cookie: `session=${session.sessionToken}` },
  });
  const question = {
    id: "first",
    question: "One unique question",
    answer: "1",
    acceptableAnswers: [],
    hint: "",
    solution: [],
    diagramSvg: "",
    difficulty: 2,
  };
  setSessionPool(request, {
    topicId: "pool-cap",
    questions: [question],
    shownIds: [],
    currentDifficulty: 2,
    batchPosition: 0,
    batchSize: 2,
    mode: "practice",
  });
  appendSessionPoolQuestion(request, { ...question, id: "duplicate-id" });
  appendSessionPoolQuestion(request, {
    ...question,
    id: "second",
    question: "Second unique question",
  });
  appendSessionPoolQuestion(request, {
    ...question,
    id: "third",
    question: "Must not fit",
  });

  expect(getSessionPool(request)?.questions.map((entry) => entry.id)).toEqual([
    "first",
    "second",
  ]);
});
