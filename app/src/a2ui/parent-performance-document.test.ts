import { expect, test } from "vitest";

import { createParentPerformanceA2uiDocument } from "./parent-performance-document";

test("compiles capped redacted parent aggregates into a read-only document", () => {
  const document = createParentPerformanceA2uiDocument([
    {
      username: "linked-child",
      performance: {
        practice: { correctPracticeAttempts: 1, activePracticeDayStreak: 0 },
        tests: { completed: 0, partial: 0 },
        nextPractice: { recommended: 0, practicing: 0, checkpointMet: 0 },
      },
    },
  ]);
  expect(document.messages[0]).toMatchObject({
    createSurface: { surfaceId: "odyssey-parent-performance" },
  });
  expect(JSON.stringify(document)).not.toMatch(
    /assignmentToken|topicId|accountId|standardCode/i,
  );
});

test("caps parent document components before renderer processing", () => {
  const children = Array.from({ length: 20 }, (_, index) => ({
    username: `child-${index}`,
    performance: {
      practice: { correctPracticeAttempts: 0, activePracticeDayStreak: 0 },
      tests: { completed: 0, partial: 0 },
      nextPractice: { recommended: 0, practicing: 0, checkpointMet: 0 },
    },
  }));
  expect(
    createParentPerformanceA2uiDocument(children).messages[1].updateComponents
      .components,
  ).toHaveLength(16);
});
