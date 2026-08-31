import { expect, test, vi } from "vitest";

vi.mock("../../../server/learning/performance", () => ({
  getLearnerPerformanceDocument: () => {
    throw new Error("fixture failure");
  },
}));

import { authenticateAccount } from "../../../server/identity/identity";
import { GET } from "./route";

test("Performance returns a generic no-store 500 when its read model fails", async () => {
  const learner = await authenticateAccount({
    username: "test-learner",
    password: "test-learner-password",
  });
  const response = GET(
    new Request("http://localhost/api/performance", {
      headers: { cookie: `session=${learner.sessionToken}` },
    }),
  );
  expect(response.status).toBe(500);
  expect(response.headers.get("cache-control")).toBe("no-store");
  await expect(response.json()).resolves.toEqual({
    error: "Performance is unavailable",
  });
});
