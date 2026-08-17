import { randomBytes, scryptSync } from "node:crypto";
import { expect, test } from "vitest";
import { authenticateChild } from "../../../../server/identity/identity";
import { learningDb } from "../../../../server/learning/sqlite-repository";
import { GET } from "./route";

function provisionAccount(
  accountId: string,
  username: string,
  password: string,
  role: "parent" | "student",
): void {
  const salt = randomBytes(16);
  learningDb
    .prepare(
      `INSERT INTO accounts (account_id, username, password_hash, salt, role)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(accountId, username, scryptSync(password, salt, 32), salt, role);
}

test("parent Performance derives active child scope and redacts details", async () => {
  provisionAccount(
    "parent-performance",
    "performance-parent",
    "parent-password",
    "parent",
  );
  provisionAccount("linked-child", "linked-child", "child-password", "student");
  provisionAccount(
    "revoked-child",
    "revoked-child",
    "child-password",
    "student",
  );
  learningDb
    .prepare(
      `INSERT INTO parent_child_links
        (parent_account_id, child_account_id, created_at, revoked_at)
       VALUES ('parent-performance', 'linked-child', 1, NULL),
              ('parent-performance', 'revoked-child', 1, 2)`,
    )
    .run();
  learningDb
    .prepare(
      `INSERT INTO learning_attempts
        (child_id, topic_id, correct, level_before, level_after, created_at)
       VALUES ('linked-child', 'Mathematics::Grade 8::Expressions::8.EE.7', 1, 1, 2, '2026-01-01')`,
    )
    .run();
  const parent = await authenticateChild({
    username: "performance-parent",
    password: "parent-password",
  });
  const response = GET(
    new Request("http://localhost/api/parent/performance", {
      headers: { cookie: `session=${parent.sessionToken}` },
    }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const body = await response.json();
  expect(body).toEqual({
    children: [
      {
        username: "linked-child",
        performance: {
          practice: { correctPracticeAttempts: 1, activePracticeDayStreak: 0 },
          tests: { completed: 0, partial: 0 },
          nextPractice: { recommended: 0, practicing: 0, checkpointMet: 0 },
        },
      },
    ],
  });
  expect(JSON.stringify(body)).not.toMatch(
    /accountId|childId|topicId|answer|score|occurredAt|standardCode/,
  );
});

test("parent Performance rejects anonymous and learner requests", async () => {
  expect(
    GET(new Request("http://localhost/api/parent/performance")).status,
  ).toBe(401);
  const learner = await authenticateChild({
    username: "test-learner",
    password: "test-learner-password",
  });
  expect(
    GET(
      new Request("http://localhost/api/parent/performance", {
        headers: { cookie: `session=${learner.sessionToken}` },
      }),
    ).status,
  ).toBe(403);
});
