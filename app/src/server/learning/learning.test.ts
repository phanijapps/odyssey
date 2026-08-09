import { expect, test } from "vitest";
import {
  getLearningProgress,
  redactLearningAudit,
  submitAnswer,
} from "./learning";
import { learningDb } from "./sqlite-repository";

// STUB: AC4

test("STUB: AC4 persists the accepted recommendation and next question", async () => {
  await expect(
    submitAnswer({
      childId: "child-1",
      topicId: "ratio",
      answer: "2",
      nextLevel: 2,
    }),
  ).resolves.toEqual({
    questionId: expect.any(String),
    level: 2,
    correct: true,
    correctStreak: 1,
    attemptCount: 1,
  });
});

test("records attempts and advances after two correct answers", async () => {
  const childId = "sqlite-test-child";
  await submitAnswer({ childId, topicId: "ratio", answer: "2", nextLevel: 1 });
  await submitAnswer({ childId, topicId: "ratio", answer: "2", nextLevel: 1 });
  expect(getLearningProgress(childId, "ratio")).toMatchObject({
    level: 2,
    correctStreak: 0,
    attemptCount: 2,
  });
});

test("treats surrounding whitespace as part of a valid numeric answer", async () => {
  const result = await submitAnswer({
    childId: "trimmed-answer-child",
    topicId: "ratio",
    answer: " 2 ",
    nextLevel: 1,
  });
  expect(result.correct).toBe(true);
});

test("rejects an all-whitespace answer before persisting an attempt", async () => {
  await expect(
    submitAnswer({
      childId: "blank-answer-child",
      topicId: "ratio",
      answer: "   ",
      nextLevel: 1,
    }),
  ).rejects.toThrow("Invalid answer");
  expect(getLearningProgress("blank-answer-child", "ratio")).toBeNull();
});

// STUB: AC16
test("STUB: AC16 redacts raw child answers from learning audit data", () => {
  expect(
    redactLearningAudit({ event: "answer-recorded", rawAnswer: "secret" }),
  ).toEqual({
    event: "answer-recorded",
  });
});

// STUB: AC9
test("STUB: AC9 persists correctness without a raw child-answer column", async () => {
  await submitAnswer({
    childId: "privacy-test-child",
    topicId: "ratio",
    answer: "answer that must not persist",
    nextLevel: 1,
  });
  const columns = learningDb
    .prepare("PRAGMA table_info(learning_attempts)")
    .all() as Array<{ name: string }>;
  expect(columns.map((column) => column.name)).not.toContain("answer");
  expect(getLearningProgress("privacy-test-child", "ratio")).toMatchObject({
    attemptCount: 1,
    correctStreak: 0,
  });
});
