import { expect, test } from "vitest";
import { authenticateAccount } from "../../../../server/identity/identity";
import { GET } from "./route";

function request(cookie?: string): Request {
  return new Request("http://localhost/api/admin/health", {
    headers: cookie ? { cookie } : undefined,
  });
}

test("health requires an admin session and is no-store", async () => {
  const anonymous = await GET(request());
  expect(anonymous.status).toBe(403);
  expect(anonymous.headers.get("cache-control")).toBe("no-store");

  const learner = await authenticateAccount({
    username: "test-learner",
    password: "test-learner-password",
  });
  const learnerResponse = await GET(request(`session=${learner.sessionToken}`));
  expect(learnerResponse.status).toBe(403);
});

test("health reports schema, catalog, and generator state for an admin", async () => {
  const admin = await authenticateAccount({
    username: "test-admin",
    password: "test-admin-password",
  });
  const response = await GET(request(`session=${admin.sessionToken}`));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const body = (await response.json()) as {
    schemaVersion: number;
    catalogRecords: number;
    generatorConfigured: boolean;
  };
  expect(body.schemaVersion).toBeGreaterThan(0);
  expect(body.catalogRecords).toBeGreaterThanOrEqual(0);
  expect(typeof body.generatorConfigured).toBe("boolean");
});
