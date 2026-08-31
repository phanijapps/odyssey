import { expect, test } from "vitest";
import { authenticateChild } from "../../../../server/identity/identity";
import { GET } from "./route";

test("Mistake-to-Mastery plan is learner-only and no-store", async () => {
  const anonymous = GET(new Request("http://localhost/api/performance/plan"));
  expect(anonymous.status).toBe(401);
  expect(anonymous.headers.get("cache-control")).toBe("no-store");

  const admin = await authenticateChild({
    username: "test-admin",
    password: "test-admin-password",
  });
  const denied = GET(
    new Request("http://localhost/api/performance/plan", {
      headers: { cookie: `session=${admin.sessionToken}` },
    }),
  );
  expect(denied.status).toBe(403);

  const learner = await authenticateChild({
    username: "test-learner",
    password: "test-learner-password",
  });
  const accepted = GET(
    new Request("http://localhost/api/performance/plan", {
      headers: { cookie: `session=${learner.sessionToken}` },
    }),
  );
  expect(accepted.status).toBe(200);
  expect(accepted.headers.get("cache-control")).toBe("no-store");
  await expect(accepted.json()).resolves.toEqual({ items: [] });
});
