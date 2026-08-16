import { expect, test } from "vitest";
import { NextRequest } from "next/server";
import { authenticateChild } from "../../../../server/identity/identity";
import { DELETE, GET } from "./route";

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

function request(
  path: string,
  init?: ConstructorParameters<typeof NextRequest>[1],
): NextRequest {
  return new NextRequest(`http://localhost${path}`, init);
}

test("restricts Gold projections to the admin steward role", async () => {
  expect(GET(request("/api/curriculum/gold?stats=1")).status).toBe(403);
  expect(
    GET(
      request("/api/curriculum/gold?stats=1", {
        headers: await sessionHeaders("test-learner"),
      }),
    ).status,
  ).toBe(403);

  const response = GET(
    request("/api/curriculum/gold?stats=1", {
      headers: await sessionHeaders("test-admin"),
    }),
  );
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual(
    expect.objectContaining({
      stats: expect.any(Object),
      topics: expect.any(Array),
    }),
  );
});

test("requires canonical origin proof before a steward deletes Gold", async () => {
  expect(
    (
      await DELETE(
        request("/api/curriculum/gold", {
          method: "DELETE",
          body: JSON.stringify({ recordId: "missing" }),
        }),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await DELETE(
        request("/api/curriculum/gold", {
          method: "DELETE",
          headers: await sessionHeaders("test-learner", "http://localhost"),
          body: JSON.stringify({ recordId: "missing" }),
        }),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await DELETE(
        request("/api/curriculum/gold", {
          method: "DELETE",
          headers: await sessionHeaders(
            "test-admin",
            "https://example.invalid",
          ),
          body: JSON.stringify({ recordId: "missing" }),
        }),
      )
    ).status,
  ).toBe(403);

  const response = await DELETE(
    request("/api/curriculum/gold", {
      method: "DELETE",
      headers: await sessionHeaders("test-admin", "http://localhost"),
      body: JSON.stringify({ recordId: "missing" }),
    }),
  );
  expect(response.status).toBe(404);
});
