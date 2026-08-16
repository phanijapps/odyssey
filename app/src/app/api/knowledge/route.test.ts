import { expect, test } from "vitest";
import { authenticateChild } from "../../../server/identity/identity";
import { GET, POST } from "./route";

async function sessionHeaders(
  username: "test-admin" | "test-learner",
  origin?: string,
): Promise<HeadersInit> {
  const session = await authenticateChild({
    username,
    password: `${username}-password`,
  });
  return {
    cookie: `session=${session.sessionToken}`,
    ...(origin ? { origin } : {}),
  };
}

test("restricts knowledge graph reads to the admin steward role", async () => {
  expect(
    (await GET(new Request("http://localhost/api/knowledge"))).status,
  ).toBe(403);
  expect(
    (
      await GET(
        new Request(
          "http://localhost/api/knowledge?q=mastery&childId=other-child",
          {
            headers: await sessionHeaders("test-learner"),
          },
        ),
      )
    ).status,
  ).toBe(403);

  const response = GET(
    new Request("http://localhost/api/knowledge", {
      headers: await sessionHeaders("test-admin"),
    }),
  );
  expect(response.status).toBe(200);
});

test("requires same-origin proof for steward knowledge graph reseeding", async () => {
  expect(
    (
      await POST(
        new Request("http://localhost/api/knowledge", { method: "POST" }),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await POST(
        new Request("http://localhost/api/knowledge", {
          method: "POST",
          headers: await sessionHeaders("test-learner", "http://localhost"),
        }),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await POST(
        new Request("http://localhost/api/knowledge", {
          method: "POST",
          headers: await sessionHeaders(
            "test-admin",
            "https://example.invalid",
          ),
        }),
      )
    ).status,
  ).toBe(403);

  const response = POST(
    new Request("http://localhost/api/knowledge", {
      method: "POST",
      headers: await sessionHeaders("test-admin", "http://localhost"),
    }),
  );
  expect(response.status).toBe(200);
});
