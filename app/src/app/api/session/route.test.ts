import { expect, test } from "vitest";
import { authenticateChild } from "../../../server/identity/identity";
import { GET, POST } from "./route";

test("reports the current authenticated child session with role", async () => {
  const session = await authenticateChild({
    username: "demo",
    password: "demo",
  });
  const response = GET(
    new Request("http://localhost/api/session", {
      headers: { cookie: `session=${session.sessionToken}` },
    }),
  );
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({
    childId: "child-1",
    username: "demo",
    role: "student",
  });
});

test("issues a session cookie for a provisioned account", async () => {
  const response = await POST(
    new Request("http://localhost/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "demo",
        password: "demo",
      }),
    }),
  );
  expect(response.status).toBe(200);
  const payload = await response.json();
  expect(payload.role).toBe("student");
  expect(response.headers.get("set-cookie")).toContain("session=");
});

test("rejects unknown credentials", async () => {
  const response = await POST(
    new Request("http://localhost/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "nobody", password: "wrong" }),
    }),
  );
  expect(response.status).toBe(401);
  await expect(response.json()).resolves.toEqual({
    error: "Invalid credentials",
  });
});
