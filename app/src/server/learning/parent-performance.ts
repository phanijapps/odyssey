import "server-only";

import { daysSinceLastCorrectPractice, getAchievements } from "./achievements";
import { getMistakeToMasteryPlan } from "./mistake-to-mastery";
import { learningDb } from "./sqlite-repository";

export type ParentSafePerformance = {
  readonly practice: {
    readonly correctPracticeAttempts: number;
    readonly activePracticeDayStreak: number;
    readonly lastPracticedDaysAgo: number | null;
  };
  readonly tests: {
    readonly completed: number;
    readonly partial: number;
  };
  readonly nextPractice: {
    readonly recommended: number;
    readonly practicing: number;
    readonly checkpointMet: number;
  };
};

/**
 * Projects only aggregate, child-safe evidence for an already-authorized child.
 * It intentionally omits raw responses, questions, keys, scores, timestamps,
 * account IDs, standard targets, and links/actions.
 */
export function getParentSafePerformance(
  childId: string,
  now?: Date,
): ParentSafePerformance {
  const achievements = getAchievements(childId, now);
  const testCounts = learningDb
    .prepare(
      `SELECT
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) AS partial
       FROM test_sessions
       WHERE learner_id = ? AND status IN ('completed', 'partial')`,
    )
    .get(childId) as { completed: number | null; partial: number | null };
  const plan = getMistakeToMasteryPlan(childId).items;
  return {
    practice: {
      correctPracticeAttempts: achievements.correctPracticeAttempts,
      activePracticeDayStreak: achievements.activePracticeDayStreak,
      lastPracticedDaysAgo: daysSinceLastCorrectPractice(childId, now),
    },
    tests: {
      completed: testCounts.completed ?? 0,
      partial: testCounts.partial ?? 0,
    },
    nextPractice: {
      recommended: plan.filter((item) => item.state === "recommended").length,
      practicing: plan.filter((item) => item.state === "practicing").length,
      checkpointMet: plan.filter(
        (item) => item.state === "practice-checkpoint-met",
      ).length,
    },
  };
}
