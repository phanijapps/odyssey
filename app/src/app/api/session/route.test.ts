import { expect, test } from "vitest";
import { authenticateChild } from "../../../server/identity/identity";
import { GET } from "./route";

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
