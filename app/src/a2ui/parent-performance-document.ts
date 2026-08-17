import {
  ODYSSEY_A2UI_CATALOG_ID,
  parseOdysseyParentPerformanceA2uiDocument,
  type OdysseyParentPerformanceA2uiDocument,
} from "./document";

const PARENT_PERFORMANCE_CHILD_CAP = 13;

type ParentPerformanceAggregate = {
  readonly username: string;
  readonly performance: {
    readonly practice: {
      readonly correctPracticeAttempts: number;
      readonly activePracticeDayStreak: number;
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
 * Compiles already-redacted linked-child aggregates into a bounded, read-only
 * parent surface. The catalog has no data bindings or actions.
 */
export function createParentPerformanceA2uiDocument(
  children: readonly ParentPerformanceAggregate[],
): OdysseyParentPerformanceA2uiDocument {
  const displayedChildren = children.slice(0, PARENT_PERFORMANCE_CHILD_CAP);
  const childComponents = displayedChildren.map((child, index) => ({
    component: "OdysseyText" as const,
    id: `child-${index + 1}`,
    variant: "body" as const,
    text: `${child.username}: ${child.performance.practice.correctPracticeAttempts} correct Practice answers · ${child.performance.practice.activePracticeDayStreak}-day active Practice streak. Tests: ${child.performance.tests.completed} completed, ${child.performance.tests.partial} partial. Next Practice: ${child.performance.nextPractice.recommended} recommended, ${child.performance.nextPractice.practicing} practicing, ${child.performance.nextPractice.checkpointMet} checkpoint met.`,
  }));

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
              text: "Child Performance",
            },
            {
              component: "OdysseyStatus",
              id: "summary",
              tone: children.length === 0 ? "neutral" : "positive",
              text:
                children.length === 0
                  ? "No active linked-child Performance is available yet."
                  : children.length > PARENT_PERFORMANCE_CHILD_CAP
                    ? `Aggregate Practice, Test, and next-Practice facts are shown for the first ${PARENT_PERFORMANCE_CHILD_CAP} active linked children.`
                    : "Aggregate Practice, Test, and next-Practice facts are shown for active linked children.",
            },
            ...childComponents,
          ],
        },
      },
    ],
  });
}
