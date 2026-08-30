import { expect, test } from "vitest";
import {
  claimAssessmentQuestionPreparation,
  exitAssessment,
  finalizeAssessmentQuestion,
  getActiveAssessmentState,
  getAssessmentQuestionForDisplay,
  getAssessmentResult,
  getAssessmentState,
  getLatestAssessmentState,
  markAssessmentQuestionUnavailable,
  startAssessment,
  submitAssessmentAnswer,
} from "./assessment";
import { getLearningProgress } from "./learning";
import { learningDb } from "./sqlite-repository";
import type { ResolvedGoldRecord } from "../curriculum/gold-query";

const learner = { learnerId: "assessment-test-learner", role: "student" };
const otherLearner = { learnerId: "assessment-other-learner", role: "student" };
const administrator = { learnerId: "assessment-admin", role: "admin" };

function record(id: string, grade = "Grade 6"): ResolvedGoldRecord {
  const contentJson = JSON.stringify({
    id,
    subject: "Mathematics",
    gradeOrCourse: grade,
    standardCode: id,
    standardText: `${id} reviewed content`,
  });
  return {
    recordId: id,
    subject: "Mathematics",
    grade,
    content: JSON.parse(contentJson),
    contentJson,
    contentFingerprint: `${id}-fingerprint`,
  };
}

function resolver(ids: readonly string[]): ResolvedGoldRecord[] {
  const records = ids.map((id) => record(id));
  if (new Set(ids).size !== ids.length)
    throw new Error("Invalid selected Gold records");
  return records;
}

function removeAssessments(...learnerIds: string[]): void {
  for (const learnerId of learnerIds) {
    const sessions = learningDb
      .prepare("SELECT id FROM test_sessions WHERE learner_id = ?")
      .all(learnerId) as Array<{ id: string }>;
    for (const session of sessions) {
      learningDb
        .prepare("DELETE FROM test_questions WHERE test_session_id = ?")
        .run(session.id);
      learningDb
        .prepare("DELETE FROM test_selected_records WHERE test_session_id = ?")
        .run(session.id);
    }
    learningDb
      .prepare("DELETE FROM test_sessions WHERE learner_id = ?")
      .run(learnerId);
  }
}

function createAssessment(ids = ["gold-one", "gold-two", "gold-three"]) {
  removeAssessments(learner.learnerId);
  return startAssessment({
    actor: learner,
    standardIds: ids,
    resolveRecords: resolver,
  });
}

function prepareCurrent(assessmentId: string, answer = "correct") {
  const claim = claimAssessmentQuestionPreparation({
    actor: learner,
    assessmentId,
  });
  expect(claim.status).toBe("claimed");
  if (claim.status !== "claimed")
    throw new Error("Expected a preparation claim");
  return finalizeAssessmentQuestion({
    actor: learner,
    assessmentId,
    ordinal: claim.ordinal,
    leaseToken: claim.leaseToken,
    question: {
      question: `Question ${claim.ordinal}`,
      answer,
      acceptableAnswers: [answer.toUpperCase()],
      hint: "not for active display",
      solution: ["review only"],
    },
  });
}

function submitCurrent(assessmentId: string, answer: string) {
  const assignment = getAssessmentQuestionForDisplay({
    actor: learner,
    assessmentId,
  });
  if (!assignment) throw new Error("Expected a ready assessment assignment");
  return submitAssessmentAnswer({
    actor: learner,
    assessmentId,
    answer,
    assignmentToken: assignment.assignmentToken,
  });
}

test("allocates nine round-robin assignments with the fixed difficulty plan", () => {
  const assessment = createAssessment();
  expect(assessment.questions.map((question) => question.goldRecordId)).toEqual(
    [
      "gold-one",
      "gold-two",
      "gold-three",
      "gold-one",
      "gold-two",
      "gold-three",
      "gold-one",
      "gold-two",
      "gold-three",
    ],
  );
  expect(
    assessment.questions.map((question) => question.plannedDifficulty),
  ).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3]);
  expect(assessment.score).toBe(0);

  expect(() =>
    startAssessment({
      actor: learner,
      standardIds: ["gold-one", "gold-one"],
      resolveRecords: resolver,
    }),
  ).toThrow("Invalid selected Gold records");
});

test("requires a learner, creates one active assessment, and snapshots selected content", () => {
  removeAssessments(learner.learnerId, otherLearner.learnerId);
  expect(() =>
    startAssessment({
      actor: administrator,
      standardIds: ["gold-one"],
      resolveRecords: resolver,
    }),
  ).toThrow("Assessment access required");

  const selected = [record("gold-one"), record("gold-two")];
  const started = startAssessment({
    actor: learner,
    standardIds: ["gold-one", "gold-two"],
    resolveRecords: () => selected,
  });
  // Simulate a later Gold edit/removal: the active test reads only its snapshot.
  selected[0] = record("gold-one", "Grade 7");
  selected.pop();
  const resumed = startAssessment({
    actor: learner,
    standardIds: ["unrelated"],
    resolveRecords: () => {
      throw new Error("A resumed assessment must not resolve Gold again");
    },
  });
  expect(resumed.id).toBe(started.id);
  expect(resumed.selectedRecords.map((item) => item.recordId)).toEqual([
    "gold-one",
    "gold-two",
  ]);
  expect(resumed.grade).toBe("Grade 6");
  expect(() =>
    getAssessmentState({ actor: otherLearner, assessmentId: started.id }),
  ).toThrow("Assessment unavailable");
});

test("loads only the learner's active assessment and keeps terminal sessions out of resume", () => {
  removeAssessments(learner.learnerId, otherLearner.learnerId);
  const assessment = startAssessment({
    actor: learner,
    standardIds: ["gold-one"],
    resolveRecords: resolver,
  });

  expect(getActiveAssessmentState({ actor: learner })?.id).toBe(assessment.id);
  expect(getLatestAssessmentState({ actor: otherLearner })).toBeNull();

  exitAssessment({ actor: learner, assessmentId: assessment.id });

  expect(getActiveAssessmentState({ actor: learner })).toBeNull();
  expect(getLatestAssessmentState({ actor: learner })).toMatchObject({
    id: assessment.id,
    status: "partial",
  });
});

test("conditionally claims one preparation lease and preserves finalized questions", () => {
  const assessment = createAssessment(["gold-one"]);
  const first = claimAssessmentQuestionPreparation({
    actor: learner,
    assessmentId: assessment.id,
    now: 100,
  });
  const second = claimAssessmentQuestionPreparation({
    actor: learner,
    assessmentId: assessment.id,
    now: 101,
  });
  expect(first.status).toBe("claimed");
  expect(second).toEqual({ status: "preparing", ordinal: 1 });
  if (first.status !== "claimed") throw new Error("Expected a claim");

  finalizeAssessmentQuestion({
    actor: learner,
    assessmentId: assessment.id,
    ordinal: first.ordinal,
    leaseToken: first.leaseToken,
    question: { question: "A retained question", answer: "2" },
    now: 101,
  });
  expect(
    claimAssessmentQuestionPreparation({
      actor: learner,
      assessmentId: assessment.id,
    }),
  ).toEqual({
    status: "ready",
    ordinal: 1,
  });
});

test("rejects an expired preparation lease and makes generation failures retryable", () => {
  const assessment = createAssessment(["gold-one"]);
  const claim = claimAssessmentQuestionPreparation({
    actor: learner,
    assessmentId: assessment.id,
    now: 100,
  });
  expect(claim.status).toBe("claimed");
  if (claim.status !== "claimed")
    throw new Error("Expected a preparation claim");

  expect(() =>
    finalizeAssessmentQuestion({
      actor: learner,
      assessmentId: assessment.id,
      ordinal: claim.ordinal,
      leaseToken: claim.leaseToken,
      question: { question: "Expired", answer: "2" },
      now: 30_100,
    }),
  ).toThrow("Assessment preparation unavailable");

  const retry = claimAssessmentQuestionPreparation({
    actor: learner,
    assessmentId: assessment.id,
    now: 30_101,
  });
  expect(retry.status).toBe("claimed");
  if (retry.status !== "claimed") throw new Error("Expected a retry claim");
  const unavailable = markAssessmentQuestionUnavailable({
    actor: learner,
    assessmentId: assessment.id,
    ordinal: retry.ordinal,
    leaseToken: retry.leaseToken,
  });
  expect(unavailable.questions[0].preparationStatus).toBe("unavailable");
  expect(
    claimAssessmentQuestionPreparation({
      actor: learner,
      assessmentId: assessment.id,
    }),
  ).toMatchObject({ status: "claimed", ordinal: 1 });
});

test("grades the same answer text for the next server assignment", () => {
  const assessment = createAssessment(["gold-one"]);
  prepareCurrent(assessment.id, "same");
  submitCurrent(assessment.id, "same");
  prepareCurrent(assessment.id, "same");

  const state = submitCurrent(assessment.id, "same");
  expect(
    state.questions.slice(0, 2).map((question) => question.answered),
  ).toEqual([true, true]);
  expect(state.score).toBe(0);
});

test("keeps a replay token bound to its graded assignment when the next is ready", () => {
  const assessment = createAssessment(["gold-one"]);
  prepareCurrent(assessment.id, "same");
  const first = getAssessmentQuestionForDisplay({
    actor: learner,
    assessmentId: assessment.id,
  });
  expect(first?.assignmentToken).toEqual(expect.any(String));
  expect(
    getAssessmentQuestionForDisplay({
      actor: learner,
      assessmentId: assessment.id,
    })?.assignmentToken,
  ).toBe(first?.assignmentToken);
  if (!first) throw new Error("Expected first ready assignment");
  submitAssessmentAnswer({
    actor: learner,
    assessmentId: assessment.id,
    answer: "same",
    assignmentToken: first.assignmentToken,
  });

  prepareCurrent(assessment.id, "same");
  const next = getAssessmentQuestionForDisplay({
    actor: learner,
    assessmentId: assessment.id,
  });
  expect(next?.ordinal).toBe(2);
  if (!next) throw new Error("Expected next ready assignment");

  const replay = submitAssessmentAnswer({
    actor: learner,
    assessmentId: assessment.id,
    answer: "same",
    assignmentToken: first.assignmentToken,
  });
  expect(
    replay.questions.slice(0, 2).map((question) => question.answered),
  ).toEqual([true, false]);
  expect(replay.score).toBe(0);

  const gradedNext = submitAssessmentAnswer({
    actor: learner,
    assessmentId: assessment.id,
    answer: "same",
    assignmentToken: next.assignmentToken,
  });
  expect(gradedNext.questions[1].answered).toBe(true);
});

test("grades only prepared active questions, is opaque and idempotent, and freezes completion", () => {
  const assessment = createAssessment(["gold-one"]);
  expect(() =>
    submitAssessmentAnswer({
      actor: learner,
      assessmentId: assessment.id,
      answer: "correct",
      assignmentToken: "unissued-token",
    }),
  ).toThrow("Assessment question unavailable");

  for (let ordinal = 1; ordinal <= 9; ordinal += 1) {
    prepareCurrent(assessment.id, `answer-${ordinal}`);
    const state = submitCurrent(assessment.id, `answer-${ordinal}`);
    expect(state.questions[ordinal - 1].answered).toBe(true);
    expect(Object.keys(state.questions[ordinal - 1])).not.toContain("correct");
    expect(Object.keys(state.questions[ordinal - 1])).not.toContain("points");
  }
  const complete = getAssessmentState({
    actor: learner,
    assessmentId: assessment.id,
  });
  expect(complete).toMatchObject({ status: "completed", score: 180 });
  expect(
    getAssessmentResult({ actor: learner, assessmentId: assessment.id }),
  ).toMatchObject({
    score: 180,
    questions: expect.arrayContaining([
      expect.objectContaining({
        ordinal: 1,
        correct: true,
        points: 10,
        correctAnswer: "answer-1",
      }),
    ]),
  });
  const afterRetry = submitAssessmentAnswer({
    actor: learner,
    assessmentId: assessment.id,
    answer: "anything",
    assignmentToken: "completed-assignment",
  });
  expect(afterRetry).toMatchObject({ status: "completed", score: 180 });
});

test("exits only the learner's active assessment as a timestamped partial review", () => {
  const assessment = createAssessment(["gold-one"]);
  prepareCurrent(assessment.id, "retained-answer");
  submitCurrent(assessment.id, "retained-answer");
  const exitedAt = new Date("2026-08-16T12:00:00.000Z");

  expect(() =>
    exitAssessment({ actor: otherLearner, assessmentId: assessment.id }),
  ).toThrow("Assessment unavailable");
  const partial = exitAssessment({
    actor: learner,
    assessmentId: assessment.id,
    now: exitedAt,
  });
  expect(partial).toMatchObject({
    status: "partial",
    score: 10,
    completedAt: exitedAt.toISOString(),
  });
  expect(
    learningDb
      .prepare("SELECT completed_at FROM test_sessions WHERE id = ?")
      .get(assessment.id),
  ).toEqual({ completed_at: exitedAt.toISOString() });
  expect(
    getAssessmentResult({ actor: learner, assessmentId: assessment.id }),
  ).toMatchObject({
    status: "partial",
    score: 10,
    completedAt: exitedAt.toISOString(),
    questions: [
      expect.objectContaining({
        ordinal: 1,
        correct: true,
        points: 10,
        correctAnswer: "retained-answer",
      }),
    ],
  });
  expect(
    getAssessmentResult({ actor: learner, assessmentId: assessment.id })
      .questions,
  ).toHaveLength(1);

  const replacement = startAssessment({
    actor: learner,
    standardIds: ["gold-two"],
    resolveRecords: resolver,
  });
  expect(replacement).toMatchObject({ status: "active" });
  expect(replacement.id).not.toBe(assessment.id);
});

test("never records assessment responses in practice progress or learning attempts", () => {
  const assessment = createAssessment(["gold-one"]);
  prepareCurrent(assessment.id, "assessment-only");
  submitCurrent(assessment.id, "assessment-only");

  expect(getLearningProgress(learner.learnerId, "gold-one")).toBeNull();
  const attemptCount = learningDb
    .prepare(
      "SELECT COUNT(*) AS count FROM learning_attempts WHERE child_id = ?",
    )
    .get(learner.learnerId) as { count: number };
  expect(attemptCount.count).toBe(0);
  const stored = learningDb
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'test_questions'",
    )
    .get() as { sql: string };
  expect(stored.sql).not.toContain("learner_answer");
});
