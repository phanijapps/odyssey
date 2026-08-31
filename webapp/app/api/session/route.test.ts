import { afterEach, expect, test, vi } from "vitest";
import { authenticateAccount } from "../../../server/identity/identity";
import { DELETE, GET, POST } from "./route";
afterEach(() => vi.unstubAllEnvs());

test("reports the current authenticated child session with role", async () => {
  const session = await authenticateAccount({
    username: "test-learner",
    password: "test-learner-password",
  });
  const response = GET(
    new Request("http://localhost/api/session", {
      headers: { cookie: `session=${session.sessionToken}` },
    }),
  );
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({
    childId: "test-learner",
    username: "test-learner",
    role: "student",
  });
});

test("issues a session cookie for a provisioned account", async () => {
  const response = await POST(
    new Request("http://localhost/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "test-learner",
        password: "test-learner-password",
      }),
    }),
  );
  expect(response.status).toBe(200);
  const payload = await response.json();
  expect(payload.role).toBe("student");
  expect(response.headers.get("set-cookie")).toContain("session=");
});

test.each([
  { username: "test-learner" },
  { password: "test-learner-password" },
  {
    username: "test-learner",
    password: "test-learner-password",
    role: "student",
  },
  { username: ["test-learner"], password: "test-learner-password" },
  { username: "test-learner", password: null },
  ["test-learner", "test-learner-password"],
])(
  "rejects a sign-in body that is not the exact credentials DTO",
  async (body) => {
    const response = await POST(
      new Request("http://localhost/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid credentials",
    });
  },
);

test("rejects unknown credentials", async () => {
  const response = await POST(
    new Request("http://localhost/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "nobody", password: "wrong" }),
    }),
  );
  expect(response.status).toBe(401);
  await expect(response.json()).resolves.toEqual({
    error: "Invalid credentials",
  });
});

test("marks expired session cookies Secure in production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  const response = await DELETE(
    new Request("https://app.example.invalid/api/session"),
  );
  expect(response.headers.get("set-cookie")).toContain("Secure");
});
