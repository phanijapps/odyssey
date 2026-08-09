import { expect, test } from "vitest";
import { authenticateChild } from "../../../server/identity/identity";
import { GET, POST } from "./route";

test("reports the current authenticated child session", async () => {
  const session = await authenticateChild({
    username: "child",
    password: "development-password",
  });
  const response = GET(
    new Request("http://localhost/api/session", {
      headers: { cookie: `session=${session.sessionToken}` },
    }),
  );
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ childId: "child-1" });
});

test("does not expose the development seed through a non-development route", async () => {
  const response = await POST(
    new Request("http://localhost/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "child",
        password: "development-password",
      }),
    }),
  );
  expect(response.status).toBe(401);
  await expect(response.json()).resolves.toEqual({
    error: "Invalid credentials",
  });
});
