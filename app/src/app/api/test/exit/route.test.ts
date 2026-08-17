import { afterEach, expect, test, vi } from "vitest";

const { requireLearnerMutationProof, exitAssessment, getAssessmentResult } =
  vi.hoisted(() => ({
    requireLearnerMutationProof: vi.fn(),
    exitAssessment: vi.fn(),
    getAssessmentResult: vi.fn(),
  }));

vi.mock("../../../../server/identity/identity", () => ({
  requireLearnerMutationProof,
}));
vi.mock("../../../../server/learning/assessment", () => ({
  exitAssessment,
  getAssessmentResult,
}));

import { POST } from "./route";

afterEach(() => vi.resetAllMocks());

test("exits only the authenticated learner's test and returns partial review", async () => {
  requireLearnerMutationProof.mockReturnValue({ childId: "learner-1" });
  exitAssessment.mockReturnValue({
    id: "test-1",
    status: "partial",
    score: 10,
  });
  getAssessmentResult.mockReturnValue({
    id: "test-1",
    status: "partial",
    score: 10,
    questions: [{ ordinal: 1, correct: true, points: 10, correctAnswer: "2" }],
  });

  const response = await POST(
    new Request("http://localhost/api/test/exit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assessmentId: "test-1" }),
    }),
  );

  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(exitAssessment).toHaveBeenCalledWith({
    actor: { learnerId: "learner-1", role: "student" },
    assessmentId: "test-1",
  });
  await expect(response.json()).resolves.toMatchObject({
    result: { status: "partial", questions: [{ correctAnswer: "2" }] },
  });
});

test("rejects malformed or unauthorized exits", async () => {
  requireLearnerMutationProof.mockImplementation(() => {
    throw new Error("Learner access required");
  });
  const unauthorized = await POST(
    new Request("http://localhost/api/test/exit", { method: "POST" }),
  );
  expect(unauthorized.status).toBe(400);
  expect(unauthorized.headers.get("cache-control")).toBe("no-store");

  requireLearnerMutationProof.mockReturnValue({ childId: "learner-1" });
  const malformed = await POST(
    new Request("http://localhost/api/test/exit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assessmentId: "test-1", score: 180 }),
    }),
  );
  expect(malformed.status).toBe(400);
  expect(exitAssessment).not.toHaveBeenCalled();
});
