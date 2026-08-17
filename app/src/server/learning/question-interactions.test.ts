import { expect, test } from "vitest";
import {
  learnerQuestionInteractionSchema,
  textResponseInteraction,
} from "./question-interactions";

test("issues a bounded text response interaction without answer material", () => {
  const interaction = textResponseInteraction("Solve 2x = 8.");
  expect(interaction).toEqual({
    type: "text-response",
    prompt: "Solve 2x = 8.",
    response: { maxLength: 100 },
  });
  expect(JSON.stringify(interaction)).not.toMatch(
    /answer|score|token|solution/i,
  );
});

test("rejects unbounded or malformed interaction variants", () => {
  expect(() =>
    learnerQuestionInteractionSchema.parse({
      type: "multiple-choice",
      prompt: "Pick one.",
      options: ["A"],
    }),
  ).toThrow();
  expect(() =>
    learnerQuestionInteractionSchema.parse({
      type: "text-response",
      prompt: "P".repeat(401),
      response: { maxLength: 100 },
    }),
  ).toThrow();
});

test("permits the producer's 400-character question boundary", () => {
  expect(textResponseInteraction("P".repeat(400)).prompt).toHaveLength(400);
});
