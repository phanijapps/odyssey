import { expect, test } from "vitest";
import { withGoldDatabase } from "@odyssey/db";
import { learningDb } from "@odyssey/db";
import {
  getLearnerPerformanceReport,
  type PerformanceReport,
} from "./performance";

function seedReviewedStandard(input: {
  subject: string;
  grade: string;
  domain: string;
  standardCode: string;
  recordId: string;
}): void {
  withGoldDatabase((database) => {
    database
      .prepare(
        `INSERT INTO gold_curriculum_records
          (record_id, subject, framework, content_json, source_fingerprint, prompt_version, model, created_at)
         VALUES (?, ?, 'local', ?, 'fixture', 'fixture', 'fixture', '2026-01-01')`,
      )
      .run(
        input.recordId,
        input.subject,
        JSON.stringify({
          id: `performance-${input.domain}-${input.standardCode}`,
          subject: input.subject,
          gradeOrCourse: input.grade,
          domain: input.domain,
          standardCode: input.standardCode,
        }),
      );
  });
}

function textById(report: PerformanceReport, id: string): string {
  switch (id) {
    case "summary":
      return report.summary.text;
    case "practice-evidence":
      return report.practiceEvidence.text;
    case "practice-detail":
      return report.practiceDetail;
    case "tests-detail":
      return report.testsDetail;
    case "achievements-detail":
      return report.achievementsDetail;
    case "fun-fact-detail":
      return report.funFactDetail;
    case "separation-note":
      return report.separationNote;
    default:
      throw new Error(`Unknown report field ${id}`);
  }
}

test("Performance has neutral factual empty states", () => {
  const document = getLearnerPerformanceReport("performance-empty");
  expect(textById(document, "practice-detail")).toBe(
    "No Practice activity is recorded yet.",
  );
  expect(textById(document, "tests-detail")).toBe(
    "No completed or partial Tests are recorded yet.",
  );
});

test("marks three reviewed Practice attempts as sufficient recent evidence", () => {
  seedReviewedStandard({
    subject: "Mathematics",
    grade: "Grade 8",
    domain: "Linear",
    standardCode: "8.EE.6",
    recordId: "performance-linear-8ee6",
  });
  const insert = learningDb.prepare(
    `INSERT INTO learning_attempts
      (child_id, topic_id, correct, level_before, level_after, created_at)
     VALUES ('performance-sufficient', 'Mathematics::Grade 8::Linear::8.EE.6', 1, 1, 2, ?)`,
  );
  insert.run("2026-01-01T00:00:00.000Z");
  insert.run("2026-01-02T00:00:00.000Z");
  insert.run("2026-01-03T00:00:00.000Z");

  expect(
    textById(
      getLearnerPerformanceReport("performance-sufficient"),
      "practice-evidence",
    ),
  ).toBe("Recent reviewed Practice evidence is available for 1 skill.");
});

test("Performance caps and redacts separate Practice and terminal Test evidence", () => {
  seedReviewedStandard({
    subject: "Mathematics",
    grade: "Grade 8",
    domain: "Linear",
    standardCode: "8.EE.7",
    recordId: "performance-linear-8ee7",
  });
  const childId = "performance-recorded";
  learningDb
    .prepare(
      `INSERT INTO test_sessions
        (id, learner_id, subject, grade, status, score, created_at, completed_at)
       VALUES ('performance-recorded-guidance', ?, 'Mathematics', 'Grade 8', 'completed', 8, '2026-02-01', '2026-02-01')`,
    )
    .run(childId);
  learningDb
    .prepare(
      `INSERT INTO test_selected_records
        (test_session_id, selection_ordinal, gold_record_id, subject, grade,
         content_json, content_fingerprint)
       VALUES ('performance-recorded-guidance', 1, 'performance-recorded-gold', 'Mathematics', 'Grade 8', ?, 'fixture')`,
    )
    .run(
      JSON.stringify({
        subject: "Mathematics",
        gradeOrCourse: "Grade 8",
        domain: "Linear",
        standardCode: "8.EE.7",
        standardText: "Use linear equations.",
      }),
    );
  learningDb
    .prepare(
      `INSERT INTO test_questions
        (test_session_id, ordinal, gold_record_id, gold_content_fingerprint,
         planned_difficulty, correct, points, graded_at)
       VALUES ('performance-recorded-guidance', 1, 'performance-recorded-gold', 'fixture', 1, 0, 0, '2026-02-01')`,
    )
    .run();
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

  const document = getLearnerPerformanceReport(childId);
  const practice = textById(document, "practice-detail");
  const tests = textById(document, "tests-detail");
  expect(textById(document, "practice-evidence")).toBe(
    "More reviewed Practice activity will make a fuller recent summary available.",
  );
  expect(textById(document, "fun-fact-detail")).toContain(
    "In plane geometry, a triangle's three interior angles add up to 180 degrees.",
  );
  expect(practice).toContain("8.EE.7");
  expect(practice).not.toContain("8.EE.0");
  expect(tests).toBe(
    "Mathematics · Grade 8 · completed; Mathematics · Grade 8 · completed",
  );
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

  const document = getLearnerPerformanceReport("performance-unreviewed");
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

  const document = getLearnerPerformanceReport(childId);
  expect(textById(document, "tests-detail").length).toBeLessThanOrEqual(320);
});

function seedCompletedTestWithMissedStandard(input: {
  childId: string;
  standardCode?: string;
}): void {
  const standardCode = input.standardCode ?? "8.EE.7";
  learningDb
    .prepare(
      `INSERT INTO test_sessions
        (id, learner_id, subject, grade, status, score, created_at, completed_at)
       VALUES (?, ?, 'Mathematics', 'Grade 8', 'completed', 0, '2026-03-01', '2026-03-01')`,
    )
    .run(`${input.childId}-session`, input.childId);
  learningDb
    .prepare(
      `INSERT INTO test_selected_records
        (test_session_id, selection_ordinal, gold_record_id, subject, grade,
         content_json, content_fingerprint)
       VALUES (?, 1, 'gold-guidance-fixture', 'Mathematics', 'Grade 8', ?, 'fixture')`,
    )
    .run(
      `${input.childId}-session`,
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
       VALUES (?, 1, 'gold-guidance-fixture', 'fixture', 1, 0, 0, '2026-03-01')`,
    )
    .run(`${input.childId}-session`);
}

function guidanceCards(report: PerformanceReport) {
  return report.guidanceCards;
}

test("Performance renders a guidance card with a validated practice action for a reviewed target", () => {
  seedReviewedStandard({
    subject: "Mathematics",
    grade: "Grade 8",
    domain: "Expressions",
    standardCode: "8.EE.7",
    recordId: "performance-guidance-gold",
  });
  seedCompletedTestWithMissedStandard({ childId: "performance-guidance" });

  const cards = guidanceCards(
    getLearnerPerformanceReport("performance-guidance"),
  );
  expect(cards).toEqual([
    {
      id: "guidance-1",
      standardCode: "8.EE.7",
      statusText:
        "Missed on your latest completed Test. Practice is recommended.",
      topicId: "Mathematics::Grade 8::Expressions::8.EE.7",
    },
  ]);
});

test("Performance disables the action honestly when the target left the reviewed catalog", () => {
  seedCompletedTestWithMissedStandard({
    childId: "performance-stale",
    standardCode: "8.EE.9",
  });

  const cards = guidanceCards(getLearnerPerformanceReport("performance-stale"));
  expect(cards).toHaveLength(1);
  expect(cards[0].standardCode).toBe("8.EE.9");
  expect(cards[0].topicId).toBeUndefined();
  expect(cards[0].statusText).toContain("no longer in the reviewed curriculum");
});

test("guidance card status states checkpoint evidence without mastery claims", () => {
  seedReviewedStandard({
    subject: "Mathematics",
    grade: "Grade 8",
    domain: "Expressions",
    standardCode: "8.EE.7",
    recordId: "performance-checkpoint-gold",
  });
  seedCompletedTestWithMissedStandard({ childId: "performance-checkpoint" });
  const insert = learningDb.prepare(
    `INSERT INTO learning_attempts
      (child_id, topic_id, correct, level_before, level_after, created_at)
     VALUES ('performance-checkpoint', 'Mathematics::Grade 8::Expressions::8.EE.7', 1, 1, 2, ?)`,
  );
  insert.run("2026-03-02T00:00:00.000Z");
  insert.run("2026-03-03T00:00:00.000Z");
  insert.run("2026-03-04T00:00:00.000Z");

  const cards = guidanceCards(
    getLearnerPerformanceReport("performance-checkpoint"),
  );
  expect(cards[0].statusText).toContain("Checkpoint met");
  for (const word of [
    "mastery",
    "mastered",
    "diagnos",
    "ability",
    "prerequisite",
  ])
    expect(JSON.stringify(cards)).not.toContain(word);
});

test("long real-world topic identities stay actionable within the transport ceiling", () => {
  const longStandard = {
    subject: "English Language Arts",
    grade: "Grades 11-12",
    domain: "Reading Standards for Literacy in Science and Technical Subjects",
    standardCode: "RST.11-12.4",
  };
  seedReviewedStandard({
    ...longStandard,
    recordId: "performance-long-identity",
  });
  const longTopicId = `${longStandard.subject}::${longStandard.grade}::${longStandard.domain}::${longStandard.standardCode}`;
  expect(longTopicId.length).toBeGreaterThan(100);
  learningDb
    .prepare(
      `INSERT INTO test_sessions
        (id, learner_id, subject, grade, status, score, created_at, completed_at)
       VALUES ('performance-long-session', 'performance-long', 'English Language Arts', 'Grades 11-12', 'completed', 0, '2026-03-01', '2026-03-01')`,
    )
    .run();
  learningDb
    .prepare(
      `INSERT INTO test_selected_records
        (test_session_id, selection_ordinal, gold_record_id, subject, grade,
         content_json, content_fingerprint)
       VALUES ('performance-long-session', 1, 'performance-long-identity', 'English Language Arts', 'Grades 11-12', ?, 'fixture')`,
    )
    .run(
      JSON.stringify({
        ...longStandard,
        gradeOrCourse: longStandard.grade,
        standardText: "Cite textual evidence.",
      }),
    );
  learningDb
    .prepare(
      `INSERT INTO test_questions
        (test_session_id, ordinal, gold_record_id, gold_content_fingerprint,
         planned_difficulty, correct, points, graded_at)
       VALUES ('performance-long-session', 1, 'performance-long-identity', 'fixture', 1, 0, 0, '2026-03-01')`,
    )
    .run();

  const cards = guidanceCards(getLearnerPerformanceReport("performance-long"));
  expect(cards).toHaveLength(1);
  expect(cards[0].topicId).toBe(longTopicId);

  // Beyond the transport ceiling the card degrades honestly instead of
  // failing the whole document build.
  const oversizeGrade = "G".repeat(120);
  const oversizeDomain = "D".repeat(170);
  seedReviewedStandard({
    subject: "Mathematics",
    grade: oversizeGrade,
    domain: oversizeDomain,
    standardCode: "8.EE.7",
    recordId: "performance-oversize-identity",
  });
  learningDb
    .prepare(
      `INSERT INTO test_selected_records
        (test_session_id, selection_ordinal, gold_record_id, subject, grade,
         content_json, content_fingerprint)
       VALUES ('performance-long-session', 2, 'performance-oversize-identity', 'Mathematics', ?, ?, 'fixture')`,
    )
    .run(
      oversizeGrade,
      JSON.stringify({
        subject: "Mathematics",
        gradeOrCourse: oversizeGrade,
        domain: oversizeDomain,
        standardCode: "8.EE.7",
        standardText: "Use linear equations.",
      }),
    );
  learningDb
    .prepare(
      `INSERT INTO test_questions
        (test_session_id, ordinal, gold_record_id, gold_content_fingerprint,
         planned_difficulty, correct, points, graded_at)
       VALUES ('performance-long-session', 2, 'performance-oversize-identity', 'fixture', 1, 0, 0, '2026-03-01')`,
    )
    .run();
  const oversizeCards = guidanceCards(
    getLearnerPerformanceReport("performance-long"),
  );
  expect(oversizeCards).toHaveLength(2);
  expect(oversizeCards[1].topicId).toBeUndefined();
});
