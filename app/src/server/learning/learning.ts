import { learningDb, withLearningTransaction } from "./sqlite-repository";

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
  return withLearningTransaction(() => {
    const current = learningDb
      .prepare(
        "SELECT level, correct_streak FROM learning_progress WHERE child_id = ? AND topic_id = ?",
      )
      .get(_input.childId, _input.topicId) as
      | { level: number; correct_streak: number }
      | undefined;
    const requestedLevel =
      Number.isInteger(_input.nextLevel) &&
      _input.nextLevel >= 1 &&
      _input.nextLevel <= 13
        ? _input.nextLevel
        : 1;
    const level = current?.level ?? requestedLevel;
    const streak =
      _input.answer === "2" ? (current?.correct_streak ?? 0) + 1 : 0;
    const nextLevel = recommendNextLevel({
      currentLevel: level,
      correctStreak: streak,
      memoryAvailable: false,
    });
    learningDb
      .prepare(
        `INSERT INTO learning_attempts
    (child_id, topic_id, answer, correct, level_before, level_after, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        _input.childId,
        _input.topicId,
        _input.answer,
        _input.answer === "2" ? 1 : 0,
        level,
        nextLevel,
        new Date().toISOString(),
      );
    learningDb
      .prepare(
        `INSERT INTO learning_progress (child_id, topic_id, level, correct_streak, updated_at)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(child_id, topic_id) DO UPDATE SET level=excluded.level, correct_streak=excluded.correct_streak, updated_at=excluded.updated_at`,
      )
      .run(
        _input.childId,
        _input.topicId,
        nextLevel,
        nextLevel > level ? 0 : streak,
        new Date().toISOString(),
      );
    return { questionId: `question-${Date.now()}`, level: nextLevel };
  });
}

/** Reads server-owned progression for diagnostics and deterministic tests. */
export function getLearningProgress(
  childId: string,
  topicId: string,
): {
  level: number;
  correctStreak: number;
  attemptCount: number;
} | null {
  const progress = learningDb
    .prepare(
      "SELECT level, correct_streak FROM learning_progress WHERE child_id = ? AND topic_id = ?",
    )
    .get(childId, topicId) as
    | { level: number; correct_streak: number }
    | undefined;
  if (!progress) return null;
  const count = learningDb
    .prepare(
      "SELECT COUNT(*) AS count FROM learning_attempts WHERE child_id = ? AND topic_id = ?",
    )
    .get(childId, topicId) as { count: number };
  return {
    level: progress.level,
    correctStreak: progress.correct_streak,
    attemptCount: count.count,
  };
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
