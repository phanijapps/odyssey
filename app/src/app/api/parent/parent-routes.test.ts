import { expect, test } from "vitest";
import { authenticateChild } from "../../../server/identity/identity";
import { GET as summary } from "./summary/route";
import { POST as chat } from "./chat/route";

test("parent summary and chat reject missing sessions", async () => {
  expect(
    (await summary(new Request("http://localhost/api/parent/summary"))).status,
  ).toBe(401);
  expect(
    (
      await chat(
        new Request("http://localhost/api/parent/chat", {
          method: "POST",
          body: JSON.stringify({ message: "How?" }),
        }),
      )
    ).status,
  ).toBe(401);
});

test("parent chat returns aggregate progress for the authenticated child", async () => {
  const session = await authenticateChild({
    username: "child",
    password: "development-password",
  });
  const request = new Request("http://localhost/api/parent/chat", {
    method: "POST",
    headers: {
      cookie: `session=${session.sessionToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ message: "How is practice going?" }),
  });
  const response = await chat(request);
  expect(response.status).toBe(200);
  expect(await response.json()).toHaveProperty("reply");
});
