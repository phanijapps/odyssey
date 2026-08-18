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
  // Realistic principals: 32-hex account ids that differ from the learner
  // scope key (`child:<username>`) under which learner data is written —
  // the aggregation must bridge the two, as it previously did not.
  provisionAccount(
    "1".repeat(32),
    "performance-parent",
    "parent-password",
    "parent",
  );
  provisionAccount("2".repeat(32), "linked-child", "child-password", "student");
  provisionAccount(
    "3".repeat(32),
    "revoked-child",
    "child-password",
    "student",
  );
  learningDb
    .prepare(
      `INSERT INTO parent_child_links
        (parent_account_id, child_account_id, created_at, revoked_at)
       VALUES ('${"1".repeat(32)}', '${"2".repeat(32)}', 1, NULL),
               ('${"1".repeat(32)}', '${"3".repeat(32)}', 1, 2)`,
    )
    .run();
  learningDb
    .prepare(
      `INSERT INTO learning_attempts
        (child_id, topic_id, correct, level_before, level_after, created_at)
       VALUES ('child:linked-child', 'Mathematics::Grade 8::Expressions::8.EE.7', 1, 1, 2, '2026-08-18T16:00:00.000Z')`,
    )
    .run();
  const parent = await authenticateChild({
    username: "performance-parent",
    password: "parent-password",
  });
  const performanceRequest = () =>
    new Request("http://localhost/api/parent/performance", {
      headers: { cookie: `session=${parent.sessionToken}` },
    });
  // Frozen evaluation times: 4pm ET on the seeded ET noon Aug 18 day, and
  // two ET midnights later. No wall-clock dependence anywhere.
  const response = GET(
    performanceRequest(),
    new Date("2026-08-18T20:00:00.000Z"),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const body = await response.json();
  expect(body).toMatchObject({
    document: {
      messages: [
        { createSurface: { surfaceId: "odyssey-parent-performance" } },
        {
          updateComponents: {
            components: expect.arrayContaining([
              expect.objectContaining({
                component: "OdysseyText",
                text: expect.stringContaining(
                  "linked-child: 1 correct Practice answer · 1-day Practice streak · last practiced today",
                ),
              }),
            ]),
          },
        },
      ],
    },
  });
  // The structured children projection: active links only (revoked-child
  // absent), exact ParentSafePerformance field set, username-ascending.
  expect(body.children).toEqual([
    {
      username: "linked-child",
      performance: {
        practice: {
          correctPracticeAttempts: 1,
          activePracticeDayStreak: 1,
          lastPracticedDaysAgo: 0,
        },
        tests: { completed: 0, partial: 0 },
        nextPractice: { recommended: 0, practicing: 0, checkpointMet: 0 },
      },
    },
  ]);
  const twoDaysLater = GET(
    performanceRequest(),
    new Date("2026-08-20T20:00:00.000Z"),
  );
  expect(await (await twoDaysLater.json()).children).toEqual([
    {
      username: "linked-child",
      performance: {
        practice: {
          correctPracticeAttempts: 1,
          activePracticeDayStreak: 0,
          lastPracticedDaysAgo: 2,
        },
        tests: { completed: 0, partial: 0 },
        nextPractice: { recommended: 0, practicing: 0, checkpointMet: 0 },
      },
    },
  ]);
  expect(JSON.stringify(body)).not.toMatch(
    /accountId|childId|topicId|occurredAt|standardCode|assignmentToken/,
  );
});

test("parent Performance caps the children projection at the document cap", async () => {
  provisionAccount("a".repeat(32), "cap-parent", "parent-password", "parent");
  const children = Array.from(
    { length: 15 },
    (_, index) => `${"b".repeat(31)}${index.toString(16)}`,
  );
  const insert = learningDb.prepare(
    `INSERT INTO accounts (account_id, username, password_hash, salt, role)
     VALUES (?, ?, ?, ?, 'student')`,
  );
  const link = learningDb.prepare(
    `INSERT INTO parent_child_links
       (parent_account_id, child_account_id, created_at, revoked_at)
     VALUES ('${"a".repeat(32)}', ?, 1, NULL)`,
  );
  const salt = randomBytes(16);
  for (const [index, accountId] of children.entries()) {
    insert.run(
      accountId,
      `cap-child-${index.toString().padStart(2, "0")}`,
      scryptSync("child-password", salt, 32),
      salt,
    );
    link.run(accountId);
  }
  const parent = await authenticateChild({
    username: "cap-parent",
    password: "parent-password",
  });
  const response = GET(
    new Request("http://localhost/api/parent/performance", {
      headers: { cookie: `session=${parent.sessionToken}` },
    }),
  );
  const body = await response.json();
  expect(body.children).toHaveLength(13);
  expect(
    body.children.map((child: { username: string }) => child.username),
  ).toEqual(
    Array.from(
      { length: 13 },
      (_, index) => `cap-child-${index.toString().padStart(2, "0")}`,
    ),
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
