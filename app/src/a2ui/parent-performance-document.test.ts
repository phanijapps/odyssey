import { expect, test } from "vitest";

import { createParentPerformanceA2uiDocument } from "./parent-performance-document";

test("compiles capped redacted parent aggregates into a read-only document", () => {
  const document = createParentPerformanceA2uiDocument([
    {
      username: "linked-child",
      performance: {
        practice: {
          correctPracticeAttempts: 1,
          activePracticeDayStreak: 0,
          lastPracticedDaysAgo: null,
        },
        tests: { completed: 0, partial: 0 },
        nextPractice: { recommended: 0, practicing: 0, checkpointMet: 0 },
      },
    },
    {
      username: "busy-child",
      performance: {
        practice: {
          correctPracticeAttempts: 2,
          activePracticeDayStreak: 3,
          lastPracticedDaysAgo: 2,
        },
        tests: { completed: 1, partial: 1 },
        nextPractice: { recommended: 2, practicing: 1, checkpointMet: 1 },
      },
    },
  ]);
  expect(document.messages[0]).toMatchObject({
    createSurface: { surfaceId: "odyssey-parent-performance" },
  });
  const texts = JSON.stringify(document);
  expect(texts).toContain(
    "linked-child: 1 correct Practice answer · no Practice streak yet · hasn't practiced yet. Tests: 0 completed, 0 partial. Next Practice: 0 recommended, 0 practicing, 0 checkpoints met.",
  );
  expect(texts).toContain(
    "busy-child: 2 correct Practice answers · 3-day Practice streak · last practiced 2 days ago. Tests: 1 completed, 1 partial. Next Practice: 2 recommended, 1 practicing, 1 checkpoint met.",
  );
  expect(texts).not.toMatch(/assignmentToken|topicId|accountId|standardCode/i);
});

test("caps parent document components before renderer processing", () => {
  const children = Array.from({ length: 20 }, (_, index) => ({
    username: `child-${index}`,
    performance: {
      practice: {
        correctPracticeAttempts: 0,
        activePracticeDayStreak: 0,
        lastPracticedDaysAgo: null,
      },
      tests: { completed: 0, partial: 0 },
      nextPractice: { recommended: 0, practicing: 0, checkpointMet: 0 },
    },
  }));
  expect(
    createParentPerformanceA2uiDocument(children).messages[1].updateComponents
      .components,
  ).toHaveLength(16);
});
