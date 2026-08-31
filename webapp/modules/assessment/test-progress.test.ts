import { expect, test } from "vitest";
import { displayedQuestionOrdinal } from "./test-progress";

test("uses the served question's ordinal while a question is displayed", () => {
  expect(
    displayedQuestionOrdinal({
      servedOrdinal: 4,
      answeredCount: 3,
      assessmentActive: true,
    }),
  ).toBe(4);
});

test("counts the upcoming question while the assessment is active", () => {
  expect(
    displayedQuestionOrdinal({
      servedOrdinal: null,
      answeredCount: 3,
      assessmentActive: true,
    }),
  ).toBe(4);
});

test("never shows a tenth question on the completed nine-question screen", () => {
  expect(
    displayedQuestionOrdinal({
      servedOrdinal: null,
      answeredCount: 9,
      assessmentActive: false,
    }),
  ).toBe(9);
});

test("an exited-partial screen shows the last answered ordinal", () => {
  expect(
    displayedQuestionOrdinal({
      servedOrdinal: null,
      answeredCount: 3,
      assessmentActive: false,
    }),
  ).toBe(3);
  expect(
    displayedQuestionOrdinal({
      servedOrdinal: null,
      answeredCount: 0,
      assessmentActive: false,
    }),
  ).toBe(1);
});
