const learningActions = [
  "request-question",
  "request-diagram",
  "recommend-difficulty",
] as const;

export type LearningAction = (typeof learningActions)[number];

/** Rejects agent actions outside the reviewed child-learning tool surface. */
export function assertLearningAction(
  _action: string,
): asserts _action is LearningAction {
  if (!learningActions.includes(_action as LearningAction))
    throw new Error("Unknown learning action");
}

/** Lists the fixed application-owned action catalog for tests and diagnostics. */
export function getLearningActions(): readonly LearningAction[] {
  return learningActions;
}
