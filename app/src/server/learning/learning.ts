/** Records an allowed attempt and returns the next question for that child. */
export async function submitAnswer(
  _input: { childId: string; topicId: string; answer: string; nextLevel: number },
): Promise<{ questionId: string; level: number }> {
  throw new Error("STUB: implement session-scoped answer transaction");
}

/** Builds the bound values for an answer insert without interpolating child input. */
export function createAnswerWrite(_input: {
  childId: string;
  topicId: string;
  answer: string;
}): { sql: string; parameters: readonly string[] } {
  throw new Error("STUB: implement parameterized answer write");
}

/** Returns the minimal audit representation of a learning event. */
export function redactLearningAudit(_event: Record<string, unknown>): Record<string, unknown> {
  throw new Error("STUB: implement learning audit redaction");
}
