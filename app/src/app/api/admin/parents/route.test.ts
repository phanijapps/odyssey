import { randomBytes, scryptSync } from "node:crypto";
import { expect, test } from "vitest";
import {
  authenticateChild,
  createParentChildAccount,
} from "../../../../server/identity/identity";
import { learningDb } from "../../../../server/learning/sqlite-repository";
import { GET as getParentChildren } from "../../parent/children/route";
import { PATCH } from "./[parentId]/route";
import { GET, POST } from "./route";

function provisionAccount(
  username: string,
  password: string,
  role: "admin" | "parent" | "student",
): void {
  const salt = randomBytes(16);
  learningDb
    .prepare(
      `INSERT INTO accounts (account_id, username, password_hash, salt, role)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      randomBytes(16).toString("hex"),
      username,
      scryptSync(password, salt, 32),
      salt,
      role,
    );
}

function adminHeaders(token: string): HeadersInit {
  return {
    cookie: `session=${token}`,
    origin: "http://localhost",
    "content-type": "application/json",
  };
}

test("an admin lists, creates, and resets parent accounts", async () => {
  provisionAccount("admin-parents", "admin-password", "admin");
  const admin = await authenticateChild({
    username: "admin-parents",
    password: "admin-password",
  });

  const create = await POST(
    new Request("http://localhost/api/admin/parents", {
      method: "POST",
      headers: adminHeaders(admin.sessionToken),
      body: JSON.stringify({
        username: "admin-made-parent",
        password: "parent-password",
      }),
    }),
  );
  expect(create.status).toBe(201);
  const { parent } = (await create.json()) as { parent: { accountId: string } };

  await createParentChildAccount(parent.accountId, {
    username: "admin-made-child",
    password: "child-password",
  });

  const list = await GET(
    new Request("http://localhost/api/admin/parents", {
      headers: adminHeaders(admin.sessionToken),
    }),
  );
  expect(list.status).toBe(200);
  expect(list.headers.get("cache-control")).toBe("no-store");
  const body = (await list.json()) as {
    parents: Array<{
      accountId: string;
      username: string;
      children: Array<{ username: string }>;
    }>;
  };
  const made = body.parents.find((p) => p.username === "admin-made-parent");
  expect(made?.accountId).toBe(parent.accountId);
  expect(made?.children).toEqual([{ username: "admin-made-child" }]);

  // The created parent signs in and manages their own children.
  const parentSession = await authenticateChild({
    username: "admin-made-parent",
    password: "parent-password",
  });
  const parentView = await getParentChildren(
    new Request("http://localhost/api/parent/children", {
      headers: adminHeaders(parentSession.sessionToken),
    }),
  );
  expect(parentView.status).toBe(200);

  // Admin reset invalidates the parent's sessions and rotates the password.
  const reset = await PATCH(
    new Request(`http://localhost/api/admin/parents/${parent.accountId}`, {
      method: "PATCH",
      headers: adminHeaders(admin.sessionToken),
      body: JSON.stringify({ password: "rotated-password" }),
    }),
    { params: Promise.resolve({ parentId: parent.accountId }) },
  );
  expect(reset.status).toBe(204);
  const staleParentView = await getParentChildren(
    new Request("http://localhost/api/parent/children", {
      headers: adminHeaders(parentSession.sessionToken),
    }),
  );
  expect(staleParentView.status).toBe(401);
  await expect(
    authenticateChild({
      username: "admin-made-parent",
      password: "parent-password",
    }),
  ).rejects.toThrow();
  const rotated = await authenticateChild({
    username: "admin-made-parent",
    password: "rotated-password",
  });
  expect(rotated.sessionToken).toBeTruthy();

  // Duplicate usernames and non-parent targets fail closed.
  const duplicate = await POST(
    new Request("http://localhost/api/admin/parents", {
      method: "POST",
      headers: adminHeaders(admin.sessionToken),
      body: JSON.stringify({
        username: "admin-made-parent",
        password: "parent-password",
      }),
    }),
  );
  expect(duplicate.status).toBe(400);
  const learnerSalt = randomBytes(16);
  learningDb
    .prepare(
      `INSERT INTO accounts (account_id, username, password_hash, salt, role)
       VALUES (?, ?, ?, ?, 'student')`,
    )
    .run(
      "a".repeat(32),
      "admin-route-learner",
      scryptSync("learner-password", learnerSalt, 32),
      learnerSalt,
    );
  const wrongRole = await PATCH(
    new Request(`http://localhost/api/admin/parents/${"a".repeat(32)}`, {
      method: "PATCH",
      headers: adminHeaders(admin.sessionToken),
      body: JSON.stringify({ password: "rotated-password" }),
    }),
    { params: Promise.resolve({ parentId: "a".repeat(32) }) },
  );
  expect(wrongRole.status).toBe(403);
});

test("non-admin sessions cannot manage parents", async () => {
  provisionAccount("parent-forbidden", "parent-password", "parent");
  const parent = await authenticateChild({
    username: "parent-forbidden",
    password: "parent-password",
  });
  const parentList = await GET(
    new Request("http://localhost/api/admin/parents", {
      headers: adminHeaders(parent.sessionToken),
    }),
  );
  expect(parentList.status).toBe(403);
  expect(parentList.headers.get("cache-control")).toBe("no-store");

  provisionAccount("learner-forbidden", "learner-password", "student");
  const learner = await authenticateChild({
    username: "learner-forbidden",
    password: "learner-password",
  });
  const learnerList = await GET(
    new Request("http://localhost/api/admin/parents", {
      headers: adminHeaders(learner.sessionToken),
    }),
  );
  expect(learnerList.status).toBe(403);
});

test("admin parent routes fail closed for anonymous, malformed, and cross-origin requests", async () => {
  const anonymous = GET(new Request("http://localhost/api/admin/parents"));
  expect(anonymous.status).toBe(401);
  expect(anonymous.headers.get("cache-control")).toBe("no-store");

  provisionAccount("admin-origin", "admin-password", "admin");
  const admin = await authenticateChild({
    username: "admin-origin",
    password: "admin-password",
  });
  const malformed = await POST(
    new Request("http://localhost/api/admin/parents", {
      method: "POST",
      headers: adminHeaders(admin.sessionToken),
      body: JSON.stringify({ username: "missing-password" }),
    }),
  );
  expect(malformed.status).toBe(400);
  expect(malformed.headers.get("cache-control")).toBe("no-store");

  const crossOrigin = await POST(
    new Request("http://localhost/api/admin/parents", {
      method: "POST",
      headers: {
        ...adminHeaders(admin.sessionToken),
        origin: "https://example.invalid",
      },
      body: JSON.stringify({
        username: "cross-origin-parent",
        password: "parent-password",
      }),
    }),
  );
  expect(crossOrigin.status).toBe(403);
  expect(crossOrigin.headers.get("cache-control")).toBe("no-store");

  const badId = await PATCH(
    new Request("http://localhost/api/admin/parents/not-an-id", {
      method: "PATCH",
      headers: adminHeaders(admin.sessionToken),
      body: JSON.stringify({ password: "rotated-password" }),
    }),
    { params: Promise.resolve({ parentId: "not-an-id" }) },
  );
  expect(badId.status).toBe(400);
});
