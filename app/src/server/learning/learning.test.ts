import { expect, test } from "vitest";
import { createAnswerWrite, redactLearningAudit, submitAnswer } from "./learning";

// STUB: AC4

test("STUB: AC4 persists the accepted recommendation and next question", async () => {
  await expect(
    submitAnswer({ childId: "child-1", topicId: "ratio", answer: "2", nextLevel: 2 }),
  ).resolves.toEqual({ questionId: expect.any(String), level: 2 });
});

// STUB: AC14
test("STUB: AC14 redacts raw child answers from learning audit data", () => {
  expect(redactLearningAudit({ event: "answer-recorded", rawAnswer: "secret" })).toEqual({
    event: "answer-recorded",
  });
});

// STUB: AC9
test("STUB: AC9 binds answer values instead of interpolating SQLite input", () => {
  const childId = "child-1'; DROP TABLE children; --";
  const topicId = "ratio'; DROP TABLE topics; --";
  const answer = "2'); DROP TABLE attempts; --";

  expect(createAnswerWrite({ childId, topicId, answer })).toEqual({
    sql: "INSERT INTO attempts (child_id, topic_id, answer) VALUES (?, ?, ?)",
    parameters: [childId, topicId, answer],
  });
});
