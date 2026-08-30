export const PARENT_PERFORMANCE_CHILD_CAP = 13;

/**
 * Phrase helpers for the portal's child cards — one wording source for the
 * parent-surface projection of the aggregates (moved from the retired A2UI
 * document builder verbatim).
 */
export function formatPracticePhrases(performance: {
  practice: {
    correctPracticeAttempts: number;
    activePracticeDayStreak: number;
    lastPracticedDaysAgo: number | null;
  };
  nextPractice: { checkpointMet: number };
}): {
  answers: string;
  streak: string;
  checkpoints: string;
  recency: string;
} {
  const { practice, nextPractice } = performance;
  return {
    answers:
      practice.correctPracticeAttempts === 1
        ? "1 correct Practice answer"
        : `${practice.correctPracticeAttempts} correct Practice answers`,
    streak:
      practice.activePracticeDayStreak === 0
        ? "no Practice streak yet"
        : `${practice.activePracticeDayStreak}-day Practice streak`,
    checkpoints:
      nextPractice.checkpointMet === 1
        ? "1 checkpoint met"
        : `${nextPractice.checkpointMet} checkpoints met`,
    recency:
      practice.lastPracticedDaysAgo === null
        ? "hasn't practiced yet"
        : practice.lastPracticedDaysAgo === 0
          ? "last practiced today"
          : practice.lastPracticedDaysAgo === 1
            ? "last practiced yesterday"
            : `last practiced ${practice.lastPracticedDaysAgo} days ago`,
  };
}
