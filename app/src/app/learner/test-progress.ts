/** The ordinal shown by the active-test progress label. */
export function displayedQuestionOrdinal(input: {
  readonly servedOrdinal: number | null | undefined;
  readonly answeredCount: number;
  readonly assessmentActive: boolean;
}): number {
  if (input.servedOrdinal) return input.servedOrdinal;
  // While active, the learner is about to see the next unanswered question;
  // at completion there is no next question, so the last answered ordinal is
  // the honest value (9 of 9, never 10 of 9).
  return input.assessmentActive
    ? input.answeredCount + 1
    : Math.max(1, input.answeredCount);
}
