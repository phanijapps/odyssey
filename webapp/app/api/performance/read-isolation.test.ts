import { expect, test } from "vitest";
import { authenticateAccount } from "../../../server/identity/identity";
import { learningDb } from "@odyssey/db";
import { GET as getPerformance } from "./route";
import { GET as getPlan } from "./plan/route";

const LEARNING_STATE_TABLES = [
  "learning_progress",
  "learning_attempts",
  "test_sessions",
  "test_selected_records",
  "test_questions",
] as const;

function snapshotLearningState(childId: string): string {
  return JSON.stringify({
    ...Object.fromEntries(
      LEARNING_STATE_TABLES.map((table) => [
        table,
        learningDb.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(),
      ]),
    ),
    // auth_sessions.last_seen legitimately advances on session activity; the
    // adaptive question pool beside it must not change.
    questionPool: learningDb
      .prepare(
        "SELECT token_hash, question_pool FROM auth_sessions WHERE child_id = ? ORDER BY token_hash",
      )
      .all(childId),
  });
}

test("Performance and plan reads never mutate Practice, Test, or attempt state", async () => {
  const learner = await authenticateAccount({
    username: "test-learner",
    password: "test-learner-password",
  });
  const request = () =>
    new Request("http://localhost/api/performance", {
      headers: { cookie: `session=${learner.sessionToken}` },
    });

  learningDb
    .prepare(
      `INSERT INTO test_sessions
        (id, learner_id, subject, grade, status, score, created_at, completed_at)
       VALUES ('isolation-test', ?, 'Mathematics', 'Grade 8', 'completed', 0, '2026-03-01', '2026-03-01')`,
    )
    .run(learner.childId);
  learningDb
    .prepare(
      `INSERT INTO test_selected_records
        (test_session_id, selection_ordinal, gold_record_id, subject, grade,
         content_json, content_fingerprint)
       VALUES ('isolation-test', 1, 'gold-fixture', 'Mathematics', 'Grade 8', ?, 'fixture')`,
    )
    .run(
      JSON.stringify({
        subject: "Mathematics",
        gradeOrCourse: "Grade 8",
        domain: "Expressions",
        standardCode: "8.EE.7",
        standardText: "Use linear equations.",
      }),
    );
  learningDb
    .prepare(
      `INSERT INTO test_questions
        (test_session_id, ordinal, gold_record_id, gold_content_fingerprint,
         planned_difficulty, correct, points, graded_at)
       VALUES ('isolation-test', 1, 'gold-fixture', 'fixture', 1, 0, 0, '2026-03-01')`,
    )
    .run();
  learningDb
    .prepare(
      `INSERT INTO learning_attempts
        (child_id, topic_id, correct, level_before, level_after, created_at)
       VALUES (?, 'Mathematics::Grade 8::Expressions::8.EE.7', 1, 1, 2, '2026-03-02')`,
    )
    .run(learner.childId);

  const before = snapshotLearningState(learner.childId);
  expect(getPerformance(request()).status).toBe(200);
  expect(
    getPlan(
      new Request("http://localhost/api/performance/plan", {
        headers: { cookie: `session=${learner.sessionToken}` },
      }),
    ).status,
  ).toBe(200);
  expect(snapshotLearningState(learner.childId)).toBe(before);
});
