import {
  createLearningAttemptWrite,
  learningDb,
  withLearningTransaction,
} from "./sqlite-repository";

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
}): Promise<{
  questionId: string;
  level: number;
  correct: boolean;
  correctStreak: number;
  attemptCount: number;
}> {
  const normalizedAnswer = _input.answer.trim();
  if (!_input.childId || !_input.topicId || !normalizedAnswer)
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
    const correct = normalizedAnswer === "2";
    const streak = correct ? (current?.correct_streak ?? 0) + 1 : 0;
    const nextLevel = recommendNextLevel({
      currentLevel: level,
      correctStreak: streak,
      memoryAvailable: false,
    });
    const correctStreak = nextLevel > level ? 0 : streak;
    const attemptWrite = createLearningAttemptWrite({
      childId: _input.childId,
      topicId: _input.topicId,
      correct,
      levelBefore: level,
      levelAfter: nextLevel,
      createdAt: new Date().toISOString(),
    });
    learningDb.prepare(attemptWrite.sql).run(...attemptWrite.parameters);
    learningDb
      .prepare(
        `INSERT INTO learning_progress (child_id, topic_id, level, correct_streak, updated_at)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(child_id, topic_id) DO UPDATE SET level=excluded.level, correct_streak=excluded.correct_streak, updated_at=excluded.updated_at`,
      )
      .run(
        _input.childId,
        _input.topicId,
        nextLevel,
        correctStreak,
        new Date().toISOString(),
      );
    const attemptCount = (
      learningDb
        .prepare(
          "SELECT COUNT(*) AS count FROM learning_attempts WHERE child_id = ? AND topic_id = ?",
        )
        .get(_input.childId, _input.topicId) as { count: number }
    ).count;
    return {
      questionId: `question-${Date.now()}`,
      level: nextLevel,
      correct,
      correctStreak,
      attemptCount,
    };
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

/** Returns aggregate progress suitable for a parent-facing summary. */
export function getParentProgressSummary(childId: string): {
  topics: Array<{ topicId: string; level: number; attempts: number }>;
  totalAttempts: number;
} {
  const topics = learningDb
    .prepare(
      `SELECT p.topic_id AS topicId, p.level AS level, COUNT(a.id) AS attempts
      FROM learning_progress p LEFT JOIN learning_attempts a
      ON a.child_id = p.child_id AND a.topic_id = p.topic_id
      WHERE p.child_id = ? GROUP BY p.topic_id, p.level`,
    )
    .all(childId) as Array<{
    topicId: string;
    level: number;
    attempts: number;
  }>;
  return {
    topics,
    totalAttempts: topics.reduce((sum, topic) => sum + topic.attempts, 0),
  };
}

/** Returns the minimal audit representation of a learning event. */
export function redactLearningAudit(
  _event: Record<string, unknown>,
): Record<string, unknown> {
  return { event: _event.event ?? "learning-event" };
}
