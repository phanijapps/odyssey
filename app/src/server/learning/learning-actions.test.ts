import { expect, test } from "vitest";
import { assertLearningAction, getLearningActions } from "./learning-actions";

test("allows only the three reviewed learning actions", () => {
  expect(getLearningActions()).toEqual([
    "request-question",
    "request-diagram",
    "recommend-difficulty",
  ]);
  for (const action of getLearningActions())
    expect(() => assertLearningAction(action)).not.toThrow();
  expect(() => assertLearningAction("delete-progress")).toThrow(
    "Unknown learning action",
  );
});
