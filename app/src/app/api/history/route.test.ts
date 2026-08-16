import { afterEach, expect, test, vi } from "vitest";

const { resolveSession, getLearnerHistory } = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  getLearnerHistory: vi.fn(),
}));

vi.mock("../../../server/identity/identity", () => ({ resolveSession }));
vi.mock("../../../server/learning/learning", () => ({ getLearnerHistory }));

import { GET } from "./route";

afterEach(() => vi.resetAllMocks());

test("returns the authenticated learner's redacted combined history", async () => {
  resolveSession.mockReturnValue({
    childId: "learner-1",
    username: "learner",
    role: "student",
  });
  getLearnerHistory.mockReturnValue([
    { kind: "test", assessmentId: "test-1", status: "partial", score: 10 },
  ]);

  const response = GET(
    new Request("http://localhost/api/history", {
      headers: { cookie: "session=learner-token" },
    }),
  );

  expect(response.status).toBe(200);
  expect(getLearnerHistory).toHaveBeenCalledWith("learner-1");
  await expect(response.json()).resolves.toEqual({
    entries: [
      { kind: "test", assessmentId: "test-1", status: "partial", score: 10 },
    ],
  });
});

test("rejects anonymous and non-learner history reads", () => {
  expect(GET(new Request("http://localhost/api/history")).status).toBe(401);
  resolveSession.mockReturnValue({
    childId: "admin",
    username: "test-admin",
    role: "admin",
  });
  expect(
    GET(
      new Request("http://localhost/api/history", {
        headers: { cookie: "session=admin-token" },
      }),
    ).status,
  ).toBe(401);
  expect(getLearnerHistory).not.toHaveBeenCalled();
});
