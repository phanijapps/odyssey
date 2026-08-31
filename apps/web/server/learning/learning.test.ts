import { createHash } from "node:crypto";
import { expect, test } from "vitest";
import {
  getLearnerHistory,
  getLearningProgress,
  redactLearningAudit,
  submitAnswer,
  submitPracticeAssignment,
} from "./learning";
import { learningDb } from "@odyssey/db";

// STUB: AC4

test("STUB: AC4 persists the accepted recommendation and next question", async () => {
  await expect(
    submitAnswer({
      childId: "child-1",
      topicId: "ratio",
      answer: "2",
      expectedAnswer: "2",
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
  await submitAnswer({
    childId,
    topicId: "ratio",
    answer: "2",
    expectedAnswer: "2",
    nextLevel: 1,
  });
  await submitAnswer({
    childId,
    topicId: "ratio",
    answer: "2",
    expectedAnswer: "2",
    nextLevel: 1,
  });
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
    expectedAnswer: "2",
    nextLevel: 1,
  });
  expect(result.correct).toBe(true);
});

test("counts progress only for the requested child and topic", async () => {
  const childId = "scoped-progress-child";
  await submitAnswer({
    childId,
    topicId: "ratio",
    answer: "2",
    expectedAnswer: "2",
    nextLevel: 1,
  });
  await submitAnswer({
    childId,
    topicId: "geometry",
    answer: "3",
    expectedAnswer: "3",
    nextLevel: 1,
  });

  expect(getLearningProgress(childId, "ratio")).toMatchObject({
    attemptCount: 1,
  });
  expect(getLearningProgress(childId, "geometry")).toMatchObject({
    attemptCount: 1,
  });
});

test("does not accept an answer from a different reviewed fixture", async () => {
  const result = await submitAnswer({
    childId: "fixture-answer-child",
    topicId: "ratio",
    answer: "2",
    expectedAnswer: "3",
    nextLevel: 1,
  });
  expect(result.correct).toBe(false);
  expect(result.correctStreak).toBe(0);
});

test("rejects an all-whitespace answer before persisting an attempt", async () => {
  await expect(
    submitAnswer({
      childId: "blank-answer-child",
      topicId: "ratio",
      answer: "   ",
      expectedAnswer: "2",
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
    expectedAnswer: "2",
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

test("returns one learner's chronological practice and terminal-test history without mastery writes", () => {
  const childId = "history-test-child";
  learningDb
    .prepare("DELETE FROM learning_attempts WHERE child_id = ?")
    .run(childId);
  learningDb
    .prepare("DELETE FROM test_sessions WHERE learner_id = ?")
    .run(childId);
  learningDb
    .prepare(
      `INSERT INTO learning_attempts
        (child_id, topic_id, correct, level_before, level_after, created_at)
       VALUES (?, 'ratio', 1, 1, 2, '2026-08-16T10:00:00.000Z')`,
    )
    .run(childId);
  learningDb
    .prepare(
      `INSERT INTO test_sessions
        (id, learner_id, subject, grade, status, score, created_at, completed_at)
       VALUES (?, ?, 'Mathematics', 'Grade 6', 'partial', 10,
         '2026-08-16T11:00:00.000Z', '2026-08-16T11:05:00.000Z')`,
    )
    .run("history-partial-test", childId);

  expect(getLearningProgress(childId, "ratio")).toBeNull();
  expect(getLearnerHistory(childId)).toEqual([
    {
      kind: "test",
      assessmentId: "history-partial-test",
      subject: "Mathematics",
      grade: "Grade 6",
      status: "partial",
      score: 10,
      answeredQuestions: 0,
      totalQuestions: 0,
      occurredAt: "2026-08-16T11:05:00.000Z",
    },
    {
      kind: "practice",
      attemptId: expect.any(Number),
      topicId: "ratio",
      correct: true,
      levelBefore: 1,
      levelAfter: 2,
      occurredAt: "2026-08-16T10:00:00.000Z",
    },
  ]);
  expect(getLearningProgress(childId, "ratio")).toBeNull();
});

test("service consumes a stored Practice assignment once under its transaction", async () => {
  await import("../identity/identity");
  const childId = "practice-service-child";
  const rawToken = "practice-service-session";
  const sessionTokenHash = createHash("sha256").update(rawToken).digest("hex");
  const assignmentToken = "b".repeat(43);
  learningDb
    .prepare("DELETE FROM learning_attempts WHERE child_id = ?")
    .run(childId);
  learningDb
    .prepare("DELETE FROM learning_progress WHERE child_id = ?")
    .run(childId);
  learningDb
    .prepare("DELETE FROM auth_sessions WHERE token_hash = ?")
    .run(sessionTokenHash);
  learningDb
    .prepare(
      `INSERT INTO auth_sessions
       (token_hash, child_id, username, role, created_at, last_seen, generated_requests,
        question_pool)
       VALUES (?, ?, 'practice-service', 'student', 0, 0, 0, ?)`,
    )
    .run(
      sessionTokenHash,
      childId,
      JSON.stringify({
        topicId: "service-ratio",
        questions: [
          {
            id: "service-question",
            question: "What is 1 + 1?",
            answer: "2",
            acceptableAnswers: [],
            hint: "Add one and one.",
            solution: ["1 + 1 = 2"],
            diagramSvg: "",
            difficulty: 2,
          },
        ],
        shownIds: ["service-question"],
        currentDifficulty: 2,
        batchPosition: 1,
        batchSize: 6,
        mode: "practice",
        activeAssignment: {
          questionId: "service-question",
          token: assignmentToken,
        },
      }),
    );

  expect(
    submitPracticeAssignment({
      childId,
      sessionTokenHash,
      topicId: "service-ratio",
      answer: "2",
      assignmentToken,
    }),
  ).toMatchObject({
    questionId: "service-question",
    correct: true,
    attemptCount: 1,
    nextPracticeDifficulty: 3,
  });
  expect(() =>
    submitPracticeAssignment({
      childId,
      sessionTokenHash,
      topicId: "service-ratio",
      answer: "2",
      assignmentToken,
    }),
  ).toThrow("Practice assignment unavailable");
  expect(getLearningProgress(childId, "service-ratio")).toMatchObject({
    attemptCount: 1,
  });
  const stored = learningDb
    .prepare("SELECT question_pool FROM auth_sessions WHERE token_hash = ?")
    .get(sessionTokenHash) as { question_pool: string };
  expect(JSON.parse(stored.question_pool)).toMatchObject({
    currentDifficulty: 3,
  });
  expect(JSON.parse(stored.question_pool)).not.toHaveProperty(
    "activeAssignment",
  );
});
