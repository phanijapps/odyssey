import { expect, test } from "vitest";

import {
  formatPracticePhrases,
  PARENT_PERFORMANCE_CHILD_CAP,
} from "./performance-phrases";

test("phrases render singular and plural practice aggregates", () => {
  expect(
    formatPracticePhrases({
      practice: {
        correctPracticeAttempts: 1,
        activePracticeDayStreak: 0,
        lastPracticedDaysAgo: null,
      },
      nextPractice: { checkpointMet: 0 },
    }),
  ).toEqual({
    answers: "1 correct Practice answer",
    streak: "no Practice streak yet",
    checkpoints: "0 checkpoints met",
    recency: "hasn't practiced yet",
  });

  expect(
    formatPracticePhrases({
      practice: {
        correctPracticeAttempts: 5,
        activePracticeDayStreak: 3,
        lastPracticedDaysAgo: 2,
      },
      nextPractice: { checkpointMet: 2 },
    }),
  ).toEqual({
    answers: "5 correct Practice answers",
    streak: "3-day Practice streak",
    checkpoints: "2 checkpoints met",
    recency: "last practiced 2 days ago",
  });
});

test("recency phrases cover today, yesterday, and multi-day gaps", () => {
  const base = {
    practice: {
      correctPracticeAttempts: 2,
      activePracticeDayStreak: 1,
      lastPracticedDaysAgo: 0,
    },
    nextPractice: { checkpointMet: 1 },
  };
  expect(formatPracticePhrases(base).recency).toBe("last practiced today");
  expect(
    formatPracticePhrases({
      ...base,
      practice: { ...base.practice, lastPracticedDaysAgo: 1 },
    }).recency,
  ).toBe("last practiced yesterday");
  expect(
    formatPracticePhrases({
      ...base,
      practice: { ...base.practice, lastPracticedDaysAgo: 4 },
    }).recency,
  ).toBe("last practiced 4 days ago");
  expect(formatPracticePhrases(base).checkpoints).toBe("1 checkpoint met");
});

test("the child cap matches the portal's historical document cap", () => {
  expect(PARENT_PERFORMANCE_CHILD_CAP).toBe(13);
});
