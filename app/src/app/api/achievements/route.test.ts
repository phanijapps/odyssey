import { expect, test } from "vitest";
import { authenticateChild } from "../../../server/identity/identity";
import { GET } from "./route";

test("achievements require learner scope and are no-store", async () => {
  expect(GET(new Request("http://localhost/api/achievements")).status).toBe(
    401,
  );
  const admin = await authenticateChild({
    username: "test-admin",
    password: "test-admin-password",
  });
  expect(
    GET(
      new Request("http://localhost/api/achievements", {
        headers: { cookie: `session=${admin.sessionToken}` },
      }),
    ).status,
  ).toBe(403);

  const learner = await authenticateChild({
    username: "test-learner",
    password: "test-learner-password",
  });
  const response = GET(
    new Request("http://localhost/api/achievements", {
      headers: { cookie: `session=${learner.sessionToken}` },
    }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  await expect(response.json()).resolves.toMatchObject({
    timezone: "America/New_York",
    badges: [
      { id: "practice-100", earned: false },
      { id: "practice-1000", earned: false },
    ],
  });
});
