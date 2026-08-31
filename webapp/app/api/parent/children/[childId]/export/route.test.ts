import { randomBytes, scryptSync } from "node:crypto";
import { expect, test } from "vitest";
import { authenticateAccount } from "../../../../../../server/identity/identity";
import { learningDb } from "@odyssey/db";
import { GET } from "./route";

function request(cookie: string | undefined, childId: string): Request {
  return new Request(`http://localhost/api/parent/children/${childId}/export`, {
    headers: cookie ? { cookie } : undefined,
  });
}

function provisionLinkedParent(): {
  parentAccountId: string;
  childAccountId: string;
} {
  const parentAccountId = randomBytes(16).toString("hex");
  const childAccountId = randomBytes(16).toString("hex");
  const salt = randomBytes(16);
  const suffix = parentAccountId.slice(0, 6);
  const insert = learningDb.prepare(
    `INSERT INTO accounts (account_id, username, password_hash, salt, role)
     VALUES (?, ?, ?, ?, ?)`,
  );
  insert.run(
    parentAccountId,
    `export-parent-${suffix}`,
    scryptSync("parent-password", salt, 32),
    salt,
    "parent",
  );
  insert.run(
    childAccountId,
    `export-child-${suffix}`,
    scryptSync("child-password", salt, 32),
    salt,
    "student",
  );
  learningDb
    .prepare(
      `INSERT INTO parent_child_links
         (parent_account_id, child_account_id, created_at)
       VALUES (?, ?, 1)`,
    )
    .run(parentAccountId, childAccountId);
  return { parentAccountId, childAccountId };
}

test("export requires the parent role", async () => {
  const anonymous = await GET(request(undefined, "x"), {
    params: Promise.resolve({ childId: "x" }),
  });
  expect(anonymous.status).toBe(403);

  const learner = await authenticateAccount({
    username: "test-learner",
    password: "test-learner-password",
  });
  const learnerResponse = await GET(
    request(`session=${learner.sessionToken}`, "x"),
    { params: Promise.resolve({ childId: "x" }) },
  );
  expect(learnerResponse.status).toBe(403);
});

test("export denies a child the parent is not linked to", async () => {
  const { parentAccountId } = provisionLinkedParent();
  const parent = await authenticateAccount({
    username: `export-parent-${parentAccountId.slice(0, 6)}`,
    password: "parent-password",
  });
  const stranger = randomBytes(16).toString("hex");
  void parentAccountId;
  const response = await GET(
    request(`session=${parent.sessionToken}`, stranger),
    { params: Promise.resolve({ childId: stranger }) },
  );
  expect(response.status).toBe(403);
});

test("export downloads a linked child's parent-safe progress", async () => {
  const { childAccountId, parentAccountId } = provisionLinkedParent();
  const parent = await authenticateAccount({
    username: `export-parent-${parentAccountId.slice(0, 6)}`,
    password: "parent-password",
  });
  const response = await GET(
    request(`session=${parent.sessionToken}`, childAccountId),
    { params: Promise.resolve({ childId: childAccountId }) },
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("content-disposition")).toContain("attachment");
  const body = (await response.json()) as {
    username: string;
    exportedAt: string;
    performance: { practice: unknown; tests: unknown; nextPractice: unknown };
  };
  expect(body.username).toBe(`export-child-${parentAccountId.slice(0, 6)}`);
  expect(typeof body.exportedAt).toBe("string");
  expect(body.performance.practice).toBeTruthy();
});
