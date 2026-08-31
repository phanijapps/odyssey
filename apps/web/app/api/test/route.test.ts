import { afterEach, expect, test, vi } from "vitest";

const {
  generateLazyQuestion,
  claimAssessmentQuestionPreparation,
  getAssessmentPreparationInput,
  getAssessmentQuestionForDisplay,
  getAssessmentState,
  markAssessmentQuestionUnavailable,
} = vi.hoisted(() => ({
  generateLazyQuestion: vi.fn(),
  claimAssessmentQuestionPreparation: vi.fn(),
  getAssessmentPreparationInput: vi.fn(),
  getAssessmentQuestionForDisplay: vi.fn(),
  getAssessmentState: vi.fn(),
  markAssessmentQuestionUnavailable: vi.fn(),
}));

vi.mock("@odyssey/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@odyssey/core")>()),
  generateLazyQuestion,
}));
vi.mock("../../../server/learning/assessment", () => ({
  claimAssessmentQuestionPreparation,
  getAssessmentPreparationInput,
  getAssessmentQuestionForDisplay,
  getAssessmentState,
  markAssessmentQuestionUnavailable,
  finalizeAssessmentQuestion: vi.fn(),
  getAssessmentResult: vi.fn(),
  startAssessment: vi.fn(),
}));

import { presentAssessment } from "./route";

afterEach(() => vi.resetAllMocks());

test("reports a failed generated assignment as unavailable and retryable", async () => {
  const actor = { learnerId: "learner-1", role: "student" as const };
  claimAssessmentQuestionPreparation.mockReturnValue({
    status: "claimed",
    ordinal: 1,
    leaseToken: "lease-1",
  });
  getAssessmentPreparationInput.mockReturnValue({
    standardCode: "6.RP.A.1",
    standardText: "Use ratios.",
    difficulty: 1,
  });
  generateLazyQuestion.mockResolvedValue(null);
  getAssessmentQuestionForDisplay.mockReturnValue(null);
  getAssessmentState.mockReturnValue({
    id: "assessment-1",
    status: "active",
    questions: [
      { ordinal: 1, preparationStatus: "unavailable", answered: false },
    ],
  });

  const response = await presentAssessment(actor, "assessment-1");

  expect(markAssessmentQuestionUnavailable).toHaveBeenCalledWith({
    actor,
    assessmentId: "assessment-1",
    ordinal: 1,
    leaseToken: "lease-1",
  });
  expect(response).toMatchObject({
    assessment: {
      questions: [{ ordinal: 1, preparationStatus: "unavailable" }],
    },
  });
});

test("presents a bounded interaction without assessment answer material", async () => {
  getAssessmentQuestionForDisplay.mockReturnValue({
    ordinal: 1,
    total: 9,
    question: "Solve 2x = 8.",
    assignmentToken: "11111111-1111-4111-8111-111111111111",
  });
  getAssessmentState.mockReturnValue({ id: "assessment-1", status: "active" });

  const response = await presentAssessment(
    { learnerId: "learner-1", role: "student" },
    "11111111-1111-4111-8111-111111111111",
  );

  expect(response).toMatchObject({
    question: {
      question: "Solve 2x = 8.",
      interaction: {
        type: "text-response",
        prompt: "Solve 2x = 8.",
        response: { maxLength: 100 },
      },
    },
  });
  expect(response.question).not.toHaveProperty("a2ui");
  expect(JSON.stringify(response.question)).not.toMatch(
    /correctAnswer|score|solution/i,
  );
});
