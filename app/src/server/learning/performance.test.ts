import { expect, test } from "vitest";
import { parseOdysseyA2uiDocument } from "../../a2ui/document";
import { withGoldDatabase } from "../curriculum/gold-database";
import { learningDb } from "./sqlite-repository";
import { getLearnerPerformanceDocument } from "./performance";

function seedReviewedStandard(input: {
  subject: string;
  grade: string;
  domain: string;
  standardCode: string;
}): void {
  withGoldDatabase((database) => {
    database
      .prepare(
        `INSERT INTO gold_curriculum_records
          (record_id, subject, framework, content_json, source_fingerprint, prompt_version, model, created_at)
         VALUES (?, ?, 'local', ?, 'fixture', 'fixture', 'fixture', '2026-01-01')`,
      )
      .run(
        `performance-${input.standardCode}`,
        input.subject,
        JSON.stringify({
          id: `performance-${input.standardCode}`,
          subject: input.subject,
          gradeOrCourse: input.grade,
          domain: input.domain,
          standardCode: input.standardCode,
        }),
      );
  });
}

function textById(
  document: ReturnType<typeof getLearnerPerformanceDocument>,
  id: string,
): string {
  const message = document.messages[1].updateComponents;
  const component = message.components.find((candidate) => candidate.id === id);
  if (!component || component.component === "OdysseyColumn")
    throw new Error(`Missing text component ${id}`);
  return component.text;
}

test("Performance has neutral factual empty states", () => {
  const document = getLearnerPerformanceDocument("performance-empty");
  expect(textById(document, "practice-detail")).toBe(
    "No Practice activity is recorded yet.",
  );
  expect(textById(document, "tests-detail")).toBe(
    "No completed or partial Tests are recorded yet.",
  );
});

test("Performance caps and redacts separate Practice and terminal Test evidence", () => {
  seedReviewedStandard({
    subject: "Mathematics",
    grade: "Grade 8",
    domain: "Linear",
    standardCode: "8.EE.7",
  });
  const childId = "performance-recorded";
  const attempt = learningDb.prepare(
    `INSERT INTO learning_attempts
      (child_id, topic_id, correct, level_before, level_after, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  for (let index = 0; index < 8; index += 1)
    attempt.run(
      childId,
      `Mathematics::Grade 8::Linear::8.EE.${index}`,
      1,
      1,
      2,
      `2026-01-0${index + 1}`,
    );
  learningDb
    .prepare(
      `INSERT INTO test_sessions
        (id, learner_id, subject, grade, status, score, created_at, completed_at)
       VALUES (?, ?, 'Mathematics', 'Grade 8', 'completed', 8, '2026-02-01', '2026-02-01')`,
    )
    .run("performance-test", childId);

  const document = getLearnerPerformanceDocument(childId);
  const practice = textById(document, "practice-detail");
  const tests = textById(document, "tests-detail");
  expect(textById(document, "practice-evidence")).toBe(
    "Recent reviewed Practice evidence is available for 1 skill.",
  );
  expect(textById(document, "fun-fact-detail")).toContain(
    "In plane geometry, a triangle's three interior angles add up to 180 degrees.",
  );
  expect(practice).toContain("8.EE.7");
  expect(practice).not.toContain("8.EE.0");
  expect(tests).toBe("Mathematics · Grade 8 · completed");
  expect(JSON.stringify(document)).not.toMatch(
    /attemptId|assessmentId|levelBefore|levelAfter|occurredAt|score/,
  );
});

test("Performance omits a Practice topic that is not in the reviewed catalog", () => {
  learningDb
    .prepare(
      `INSERT INTO learning_attempts
        (child_id, topic_id, correct, level_before, level_after, created_at)
       VALUES ('performance-unreviewed', 'not-reviewed::fake', 1, 1, 2, '2026-01-01')`,
    )
    .run();

  const document = getLearnerPerformanceDocument("performance-unreviewed");
  expect(textById(document, "practice-detail")).toBe(
    "No Practice activity is recorded yet.",
  );
});

test("Performance bounds malformed persisted display text", () => {
  const childId = "performance-bounded";
  learningDb
    .prepare(
      `INSERT INTO test_sessions
        (id, learner_id, subject, grade, status, score, created_at)
       VALUES (?, ?, ?, ?, 'partial', 0, '2026-02-01')`,
    )
    .run(
      "performance-bounded-test",
      childId,
      "S".repeat(1_000),
      "G".repeat(1_000),
    );

  const document = getLearnerPerformanceDocument(childId);
  expect(textById(document, "tests-detail").length).toBeLessThanOrEqual(320);
});

test("A2UI documents reject unknown components and fields", () => {
  expect(() =>
    parseOdysseyA2uiDocument({
      messages: [
        {
          version: "v0.9",
          createSurface: {
            surfaceId: "odyssey-performance",
            catalogId: "odyssey.learning.v1",
          },
        },
        {
          version: "v0.9",
          updateComponents: {
            surfaceId: "odyssey-performance",
            components: [
              { component: "UntrustedWidget", id: "root", payload: "no" },
            ],
          },
        },
      ],
    }),
  ).toThrow();
});

test("A2UI documents reject recursive component graphs", () => {
  expect(() =>
    parseOdysseyA2uiDocument({
      messages: [
        {
          version: "v0.9",
          createSurface: {
            surfaceId: "odyssey-performance",
            catalogId: "odyssey.learning.v1",
          },
        },
        {
          version: "v0.9",
          updateComponents: {
            surfaceId: "odyssey-performance",
            components: [
              { component: "OdysseyColumn", id: "root", children: ["root"] },
            ],
          },
        },
      ],
    }),
  ).toThrow(/cycle/);
});
