import { expect, test } from "vitest";
import { authenticateChild } from "../../../server/identity/identity";
import { parseOdysseyA2uiDocument } from "../../../a2ui/document";
import { GET } from "./route";

test("Performance requires a learner session and is no-store", async () => {
  const anonymous = GET(new Request("http://localhost/api/performance"));
  expect(anonymous.status).toBe(401);
  expect(anonymous.headers.get("cache-control")).toBe("no-store");

  const admin = await authenticateChild({
    username: "test-admin",
    password: "test-admin-password",
  });
  const adminResponse = GET(
    new Request("http://localhost/api/performance", {
      headers: { cookie: `session=${admin.sessionToken}` },
    }),
  );
  expect(adminResponse.status).toBe(403);
  expect(adminResponse.headers.get("cache-control")).toBe("no-store");
});

test("Performance returns a locally validated document for its learner only", async () => {
  const learner = await authenticateChild({
    username: "test-learner",
    password: "test-learner-password",
  });
  const response = GET(
    new Request("http://localhost/api/performance", {
      headers: { cookie: `session=${learner.sessionToken}` },
    }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const body = (await response.json()) as { document: unknown };
  expect(parseOdysseyA2uiDocument(body.document).messages).toHaveLength(2);
});
