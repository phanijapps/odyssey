import { expect, test } from "vitest";
import { withGoldDatabase } from "../curriculum/gold-database";
import { learningDb } from "./sqlite-repository";
import { getMistakeToMasteryPlan } from "./mistake-to-mastery";

function seedCompletedTest(input: {
  learnerId: string;
  id: string;
  completedAt: string;
  status?: "completed" | "partial";
  standardCode?: string;
}): void {
  const standardCode = input.standardCode ?? "8.EE.7";
  learningDb
    .prepare(
      `INSERT INTO test_sessions
        (id, learner_id, subject, grade, status, score, created_at, completed_at)
       VALUES (?, ?, 'Mathematics', 'Grade 8', ?, 0, '2026-01-01', ?)`,
    )
    .run(
      input.id,
      input.learnerId,
      input.status ?? "completed",
      input.completedAt,
    );
  learningDb
    .prepare(
      `INSERT INTO test_selected_records
        (test_session_id, selection_ordinal, gold_record_id, subject, grade,
         content_json, content_fingerprint)
       VALUES (?, 1, 'gold-fixture', 'Mathematics', 'Grade 8', ?, 'fixture')`,
    )
    .run(
      input.id,
      JSON.stringify({
        subject: "Mathematics",
        gradeOrCourse: "Grade 8",
        domain: "Expressions",
        standardCode,
        standardText: "Use linear equations.",
      }),
    );
  learningDb
    .prepare(
      `INSERT INTO test_questions
        (test_session_id, ordinal, gold_record_id, gold_content_fingerprint,
         planned_difficulty, correct, points, graded_at)
       VALUES (?, 1, 'gold-fixture', 'fixture', 1, 0, 0, ?)`,
    )
    .run(input.id, input.completedAt);
}

test("returns a positive empty plan when no completed Test exists", () => {
  expect(getMistakeToMasteryPlan("plan-empty")).toEqual({ items: [] });
});

test("uses only the latest completed Test and groups missed snapshot standards", () => {
  seedCompletedTest({
    learnerId: "plan-learner",
    id: "older-test",
    completedAt: "2026-01-01T00:00:00.000Z",
    standardCode: "8.EE.1",
  });
  seedCompletedTest({
    learnerId: "plan-learner",
    id: "latest-test",
    completedAt: "2026-02-01T00:00:00.000Z",
  });

  expect(getMistakeToMasteryPlan("plan-learner")).toEqual({
    items: [
      {
        standardCode: "8.EE.7",
        standardText: "Use linear equations.",
        state: "recommended",
      },
    ],
  });
});

test("ignores partial Tests and classifies only later correct Practice attempts", () => {
  seedCompletedTest({
    learnerId: "plan-practice",
    id: "completed-test",
    completedAt: "2026-02-01T00:00:00.000Z",
  });
  seedCompletedTest({
    learnerId: "plan-practice",
    id: "partial-test",
    status: "partial",
    completedAt: "2026-03-01T00:00:00.000Z",
    standardCode: "8.EE.1",
  });
  const insert = learningDb.prepare(
    `INSERT INTO learning_attempts
      (child_id, topic_id, correct, level_before, level_after, created_at)
     VALUES ('plan-practice', 'Mathematics::Grade 8::Expressions::8.EE.7', ?, 1, 2, ?)`,
  );
  insert.run(1, "2026-01-31T00:00:00.000Z");
  insert.run(0, "2026-02-02T00:00:00.000Z");
  insert.run(1, "2026-02-02T00:00:00.000Z");
  insert.run(1, "2026-02-03T00:00:00.000Z");
  insert.run(1, "2026-02-04T00:00:00.000Z");

  expect(getMistakeToMasteryPlan("plan-practice")).toEqual({
    items: [
      {
        standardCode: "8.EE.7",
        standardText: "Use linear equations.",
        state: "practice-checkpoint-met",
      },
    ],
  });
});

test("omits malformed snapshot data rather than exposing or substituting it", () => {
  seedCompletedTest({
    learnerId: "plan-malformed",
    id: "malformed-test",
    completedAt: "2026-02-01T00:00:00.000Z",
  });
  learningDb
    .prepare(
      `UPDATE test_selected_records SET content_json = '{}' WHERE test_session_id = 'malformed-test'`,
    )
    .run();

  expect(getMistakeToMasteryPlan("plan-malformed")).toEqual({ items: [] });
});

test("retains selected snapshot metadata after a later live Gold revision", () => {
  seedCompletedTest({
    learnerId: "plan-snapshot",
    id: "snapshot-test",
    completedAt: "2026-02-01T00:00:00.000Z",
  });
  withGoldDatabase((database) => {
    database
      .prepare(
        `INSERT INTO gold_curriculum_records
          (record_id, subject, framework, content_json, source_fingerprint,
           prompt_version, model, created_at)
         VALUES ('gold-fixture', 'Mathematics', 'fixture', ?, 'old', 'v1', 'fixture', '2026-01-01')`,
      )
      .run(
        JSON.stringify({ standardCode: "8.EE.7", standardText: "Old text" }),
      );
    database
      .prepare(
        `UPDATE gold_curriculum_records
         SET content_json = ?, source_fingerprint = 'later-live-gold-revision'
         WHERE record_id = 'gold-fixture'`,
      )
      .run(
        JSON.stringify({ standardCode: "changed", standardText: "New text" }),
      );
  });

  expect(getMistakeToMasteryPlan("plan-snapshot")).toEqual({
    items: [
      {
        standardCode: "8.EE.7",
        standardText: "Use linear equations.",
        state: "recommended",
      },
    ],
  });
});
