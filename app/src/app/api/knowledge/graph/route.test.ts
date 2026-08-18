import { randomBytes, scryptSync } from "node:crypto";
import { expect, test } from "vitest";
import { authenticateChild } from "../../../../server/identity/identity";
import { learningDb } from "../../../../server/learning/sqlite-repository";
import { GET } from "./route";

function provision(
  accountId: string,
  username: string,
  role: "admin" | "student",
): void {
  const salt = randomBytes(16);
  learningDb
    .prepare(
      `INSERT INTO accounts (account_id, username, password_hash, salt, role)
       VALUES (?, ?, ?, ?, ?) ON CONFLICT(username) DO NOTHING`,
    )
    .run(
      accountId,
      username,
      scryptSync(`${username}-password`, salt, 32),
      salt,
      role,
    );
}

test("graph snapshot route is admin-only and no-store", async () => {
  const anonymous = GET(new Request("http://localhost/api/knowledge/graph"));
  expect(anonymous.status).toBe(403);
  expect(anonymous.headers.get("cache-control")).toBe("no-store");
  provision("graph-view-admin", "graph-view-admin", "admin");
  provision("graph-view-student", "graph-view-student", "student");

  const admin = await authenticateChild({
    username: "graph-view-admin",
    password: "graph-view-admin-password",
  });
  const accepted = GET(
    new Request("http://localhost/api/knowledge/graph", {
      headers: { cookie: `session=${admin.sessionToken}` },
    }),
  );
  expect(accepted.status).toBe(200);
  expect(accepted.headers.get("cache-control")).toBe("no-store");
  const body = (await accepted.json()) as {
    nodes: unknown[];
    links: unknown[];
  };
  expect(Array.isArray(body.nodes)).toBe(true);
  expect(Array.isArray(body.links)).toBe(true);

  const student = await authenticateChild({
    username: "graph-view-student",
    password: "graph-view-student-password",
  });
  expect(
    GET(
      new Request("http://localhost/api/knowledge/graph", {
        headers: { cookie: `session=${student.sessionToken}` },
      }),
    ).status,
  ).toBe(403);
});
