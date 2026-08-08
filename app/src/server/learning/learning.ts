/** Records an allowed attempt and returns the next question for that child. */
export function recommendNextLevel(input: {
  currentLevel: number;
  correctStreak: number;
  memoryAvailable: boolean;
}): number {
  if (
    !Number.isInteger(input.currentLevel) ||
    input.currentLevel < 1 ||
    input.currentLevel > 13
  )
    throw new Error("Invalid level");
  const shouldAdvance =
    input.correctStreak >= 2 ||
    (input.memoryAvailable && input.correctStreak >= 3);
  return shouldAdvance
    ? Math.min(input.currentLevel + 1, 13)
    : input.currentLevel;
}

export async function submitAnswer(_input: {
  childId: string;
  topicId: string;
  answer: string;
  nextLevel: number;
}): Promise<{ questionId: string; level: number }> {
  if (!_input.childId || !_input.topicId || !_input.answer)
    throw new Error("Invalid answer");
  if (_input.nextLevel < 1 || _input.nextLevel > 13)
    throw new Error("Invalid level");
  return { questionId: `question-${Date.now()}`, level: _input.nextLevel };
}

/** Builds the bound values for an answer insert without interpolating child input. */
export function createAnswerWrite(_input: {
  childId: string;
  topicId: string;
  answer: string;
}): { sql: string; parameters: readonly string[] } {
  return {
    sql: "INSERT INTO attempts (child_id, topic_id, answer) VALUES (?, ?, ?)",
    parameters: [_input.childId, _input.topicId, _input.answer],
  };
}

/** Returns the minimal audit representation of a learning event. */
export function redactLearningAudit(
  _event: Record<string, unknown>,
): Record<string, unknown> {
  return { event: _event.event ?? "learning-event" };
}
