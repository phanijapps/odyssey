import { expect, test } from "vitest";
import { parseTextResponseInteraction } from "./question-interaction";

test("accepts only the bounded server text-response interaction", () => {
  expect(
    parseTextResponseInteraction({
      type: "text-response",
      prompt: "Solve 2x = 8.",
      response: { maxLength: 100 },
    }),
  ).toEqual({
    type: "text-response",
    prompt: "Solve 2x = 8.",
    response: { maxLength: 100 },
  });
});

test("rejects malformed interaction data before it reaches the Practice input", () => {
  expect(
    parseTextResponseInteraction({
      type: "text-response",
      prompt: "Solve 2x = 8.",
      response: { maxLength: 101 },
    }),
  ).toBeNull();
  expect(parseTextResponseInteraction({ type: "multiple-choice" })).toBeNull();
});
