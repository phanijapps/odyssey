import {
  ODYSSEY_A2UI_CATALOG_ID,
  parseOdysseyParentPerformanceA2uiDocument,
  type OdysseyParentPerformanceA2uiDocument,
} from "./document";

export const PARENT_PERFORMANCE_CHILD_CAP = 13;

type ParentPerformanceAggregate = {
  readonly username: string;
  readonly performance: {
    readonly practice: {
      readonly correctPracticeAttempts: number;
      readonly activePracticeDayStreak: number;
      readonly lastPracticedDaysAgo: number | null;
    };
    readonly tests: { readonly completed: number; readonly partial: number };
    readonly nextPractice: {
      readonly recommended: number;
      readonly practicing: number;
      readonly checkpointMet: number;
    };
  };
};

/**
 * Phrase helpers shared by the A2UI document and the portal's child cards —
 * one wording source for both projections of the same aggregates.
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

/**
 * Compiles already-redacted linked-child aggregates into a bounded, read-only
 * parent surface. The catalog has no data bindings or actions.
 */
export function createParentPerformanceA2uiDocument(
  children: readonly ParentPerformanceAggregate[],
): OdysseyParentPerformanceA2uiDocument {
  const displayedChildren = children.slice(0, PARENT_PERFORMANCE_CHILD_CAP);
  const childComponents = displayedChildren.map((child, index) => {
    const { answers, streak, checkpoints, recency } = formatPracticePhrases(
      child.performance,
    );
    const { tests, nextPractice } = child.performance;
    return {
      component: "OdysseyText" as const,
      id: `child-${index + 1}`,
      variant: "body" as const,
      text: `${child.username}: ${answers} · ${streak} · ${recency}. Tests: ${tests.completed} completed, ${tests.partial} partial. Next Practice: ${nextPractice.recommended} recommended, ${nextPractice.practicing} practicing, ${checkpoints}.`,
    };
  });

  return parseOdysseyParentPerformanceA2uiDocument({
    messages: [
      {
        version: "v0.9",
        createSurface: {
          surfaceId: "odyssey-parent-performance",
          catalogId: ODYSSEY_A2UI_CATALOG_ID,
        },
      },
      {
        version: "v0.9",
        updateComponents: {
          surfaceId: "odyssey-parent-performance",
          components: [
            {
              component: "OdysseyColumn",
              id: "root",
              children: [
                "title",
                "summary",
                ...childComponents.map((component) => component.id),
              ],
            },
            {
              component: "OdysseyText",
              id: "title",
              variant: "h2",
              text: "Child progress",
            },
            {
              component: "OdysseyStatus",
              id: "summary",
              tone: children.length === 0 ? "neutral" : "positive",
              text:
                children.length === 0
                  ? "No progress yet — it appears here as your children practice."
                  : children.length > PARENT_PERFORMANCE_CHILD_CAP
                    ? `Showing your first ${PARENT_PERFORMANCE_CHILD_CAP} children.`
                    : "Progress for each of your active children.",
            },
            ...childComponents,
          ],
        },
      },
    ],
  });
}
