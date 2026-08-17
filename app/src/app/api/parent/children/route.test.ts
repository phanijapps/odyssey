import { randomBytes, scryptSync } from "node:crypto";
import { expect, test } from "vitest";
import { learningDb } from "../../../../server/learning/sqlite-repository";
import { authenticateChild } from "../../../../server/identity/identity";
import { DELETE, PATCH } from "./[childId]/route";
import { GET, POST } from "./route";

function provisionAccount(
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
    .run(
      randomBytes(16).toString("hex"),
      username,
      scryptSync(password, salt, 32),
      salt,
      role,
    );
}

function provisionParent(username: string, password: string): void {
  provisionAccount(username, password, "parent");
}

function parentHeaders(token: string): HeadersInit {
  return {
    cookie: `session=${token}`,
    origin: "http://localhost",
    "content-type": "application/json",
  };
}

test("parent child endpoints derive scope from the parent session and link", async () => {
  provisionParent("parent-routes", "parent-password");
  const parent = await authenticateChild({
    username: "parent-routes",
    password: "parent-password",
  });
  const create = await POST(
    new Request("http://localhost/api/parent/children", {
      method: "POST",
      headers: parentHeaders(parent.sessionToken),
      body: JSON.stringify({
        username: "routed-child",
        password: "child-password",
      }),
    }),
  );
  expect(create.status).toBe(201);
  const { child } = (await create.json()) as { child: { accountId: string } };
  const list = await GET(
    new Request("http://localhost/api/parent/children", {
      headers: parentHeaders(parent.sessionToken),
    }),
  );
  expect(list.status).toBe(200);
  expect(await list.json()).toEqual({
    children: [{ accountId: child.accountId, username: "routed-child" }],
  });

  const reset = await PATCH(
    new Request(`http://localhost/api/parent/children/${child.accountId}`, {
      method: "PATCH",
      headers: parentHeaders(parent.sessionToken),
      body: JSON.stringify({ password: "updated-password" }),
    }),
    { params: Promise.resolve({ childId: child.accountId }) },
  );
  expect(reset.status).toBe(204);

  const revoke = await DELETE(
    new Request(`http://localhost/api/parent/children/${child.accountId}`, {
      method: "DELETE",
      headers: parentHeaders(parent.sessionToken),
    }),
    { params: Promise.resolve({ childId: child.accountId }) },
  );
  expect(revoke.status).toBe(204);
  const staleReset = await PATCH(
    new Request(`http://localhost/api/parent/children/${child.accountId}`, {
      method: "PATCH",
      headers: parentHeaders(parent.sessionToken),
      body: JSON.stringify({ password: "another-password" }),
    }),
    { params: Promise.resolve({ childId: child.accountId }) },
  );
  expect(staleReset.status).toBe(403);
});

test("a learner cannot read parent child accounts", async () => {
  provisionAccount("unlinked-learner", "learner-password", "student");
  const learner = await authenticateChild({
    username: "unlinked-learner",
    password: "learner-password",
  });
  const response = await GET(
    new Request("http://localhost/api/parent/children", {
      headers: parentHeaders(learner.sessionToken),
    }),
  );
  expect(response.status).toBe(403);
  expect(response.headers.get("cache-control")).toBe("no-store");
});
