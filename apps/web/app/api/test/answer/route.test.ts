import { afterEach, expect, test, vi } from "vitest";

const {
  requireLearnerMutationProof,
  submitAssessmentAnswer,
  presentAssessment,
} = vi.hoisted(() => ({
  requireLearnerMutationProof: vi.fn(),
  submitAssessmentAnswer: vi.fn(),
  presentAssessment: vi.fn(),
}));

vi.mock("../../../../server/identity/identity", () => ({
  requireLearnerMutationProof,
}));
vi.mock("../../../../server/learning/assessment", () => ({
  submitAssessmentAnswer,
}));
vi.mock("../route", () => ({ presentAssessment }));

import { POST } from "./route";

afterEach(() => vi.resetAllMocks());

test("returns the next retained assessment assignment after grading", async () => {
  requireLearnerMutationProof.mockReturnValue({ childId: "learner-1" });
  submitAssessmentAnswer.mockReturnValue({
    id: "assessment-1",
    status: "active",
  });
  presentAssessment.mockResolvedValue({
    assessment: { id: "assessment-1", status: "active", score: 10 },
    question: {
      ordinal: 2,
      total: 9,
      question: "Next retained question",
      assignmentToken: "assignment-2",
    },
  });

  const response = await POST(
    new Request("http://localhost/api/test/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        assessmentId: "assessment-1",
        answer: "2",
        assignmentToken: "assignment-1",
      }),
    }),
  );

  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(submitAssessmentAnswer).toHaveBeenCalledWith({
    actor: { learnerId: "learner-1", role: "student" },
    assessmentId: "assessment-1",
    answer: "2",
    assignmentToken: "assignment-1",
  });
  expect(presentAssessment).toHaveBeenCalledWith(
    { learnerId: "learner-1", role: "student" },
    "assessment-1",
  );
  await expect(response.json()).resolves.toMatchObject({
    question: { ordinal: 2, question: "Next retained question" },
  });
});

test("rejects an answer without the server-issued assignment token", async () => {
  requireLearnerMutationProof.mockReturnValue({ childId: "learner-1" });

  const response = await POST(
    new Request("http://localhost/api/test/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assessmentId: "assessment-1", answer: "2" }),
    }),
  );

  expect(response.status).toBe(400);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(submitAssessmentAnswer).not.toHaveBeenCalled();
});
