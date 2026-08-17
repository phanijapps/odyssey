import "server-only";

import { learningDb } from "./sqlite-repository";

const CHECKPOINT_CORRECT_ATTEMPTS = 3;
const PLAN_ITEM_CAP = 5;

type PlanState = "recommended" | "practicing" | "practice-checkpoint-met";

export type MistakeToMasteryPlan = {
  readonly items: readonly {
    readonly standardCode: string;
    readonly standardText: string;
    readonly state: PlanState;
  }[];
};

type CompletedTestRow = {
  id: string;
  completed_at: string;
};

type MissedSnapshotRow = {
  content_json: string;
};

type SnapshotStandard = {
  readonly topicId: string;
  readonly standardCode: string;
  readonly standardText: string;
};

function parseSnapshotStandard(content: string): SnapshotStandard | null {
  try {
    const value = JSON.parse(content) as Record<string, unknown>;
    const subject = value.subject;
    const grade = value.gradeOrCourse;
    const domain = value.domain;
    const standardCode = value.standardCode;
    const standardText = value.standardText;
    if (
      typeof subject !== "string" ||
      typeof grade !== "string" ||
      typeof domain !== "string" ||
      typeof standardCode !== "string" ||
      typeof standardText !== "string" ||
      !subject.trim() ||
      !grade.trim() ||
      !domain.trim() ||
      !standardCode.trim() ||
      !standardText.trim() ||
      [subject, grade, domain, standardCode, standardText].some(
        (field) => field.length > 200,
      )
    )
      return null;
    return {
      topicId: `${subject}::${grade}::${domain}::${standardCode}`,
      standardCode,
      standardText,
    };
  } catch {
    return null;
  }
}

function stateForCorrectAttempts(correctAttempts: number): PlanState {
  if (correctAttempts >= CHECKPOINT_CORRECT_ATTEMPTS)
    return "practice-checkpoint-met";
  if (correctAttempts > 0) return "practicing";
  return "recommended";
}

/**
 * Derives a read-only learner plan from the latest completed Test snapshot.
 * Partial Tests, raw answers, question content, and live-Gold substitutions
 * are deliberately excluded.
 */
export function getMistakeToMasteryPlan(
  learnerId: string,
): MistakeToMasteryPlan {
  const source = learningDb
    .prepare(
      `SELECT id, completed_at
       FROM test_sessions
       WHERE learner_id = ? AND status = 'completed' AND completed_at IS NOT NULL
       ORDER BY completed_at DESC, id DESC LIMIT 1`,
    )
    .get(learnerId) as CompletedTestRow | undefined;
  if (!source) return { items: [] };

  const missed = learningDb
    .prepare(
      `SELECT DISTINCT selected.content_json
       FROM test_questions AS question
       JOIN test_selected_records AS selected
         ON selected.test_session_id = question.test_session_id
        AND selected.gold_record_id = question.gold_record_id
       WHERE question.test_session_id = ? AND question.correct = 0
       ORDER BY selected.selection_ordinal`,
    )
    .all(source.id) as MissedSnapshotRow[];

  const standards = [
    ...new Map(
      missed
        .map((row) => parseSnapshotStandard(row.content_json))
        .filter((standard): standard is SnapshotStandard => standard !== null)
        .map((standard) => [standard.topicId, standard]),
    ).values(),
  ].slice(0, PLAN_ITEM_CAP);
  const correctAttempts = learningDb.prepare(
    `SELECT COUNT(*) AS count
     FROM learning_attempts
     WHERE child_id = ? AND topic_id = ? AND correct = 1 AND created_at > ?`,
  );

  return {
    items: standards.map((standard) => {
      const row = correctAttempts.get(
        learnerId,
        standard.topicId,
        source.completed_at,
      ) as { count: number };
      return {
        standardCode: standard.standardCode,
        standardText: standard.standardText,
        state: stateForCorrectAttempts(row.count),
      };
    }),
  };
}
