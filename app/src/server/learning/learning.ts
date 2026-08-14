import {
  createLearningAttemptWrite,
  learningDb,
  withLearningTransaction,
} from "./sqlite-repository";
import { assertLearningAction } from "./learning-actions";

/** Compares a submitted answer against expected and acceptable answers. */
export function checkAnswer(
  submitted: string,
  expected: string,
  acceptable?: readonly string[],
): boolean {
  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const submittedNorm = normalize(submitted);
  const expectedNorm = normalize(expected);
  if (submittedNorm === expectedNorm) return true;
  if (acceptable?.some((a) => normalize(a) === submittedNorm)) return true;
  const isPureNumber = (s: string) =>
    /^-?\d+(?:\.\d+)?$/.test(
      s
        .replace(
          /\s*(cups?|pounds?|lbs?|marbles?|girls?|apples?|pages?|degrees?|feet|hours?|minutes?|mph|miles per hour)\s*$/i,
          "",
        )
        .trim(),
    );
  if (isPureNumber(submittedNorm) && isPureNumber(expectedNorm)) {
    const submittedNum = Number.parseFloat(submittedNorm);
    const expectedNum = Number.parseFloat(expectedNorm);
    if (!Number.isNaN(submittedNum) && !Number.isNaN(expectedNum))
      return Math.abs(submittedNum - expectedNum) < 0.01;
  }
  return false;
}

/** Records an allowed attempt and returns the next question for that child. */
export function recommendNextLevel(input: {
  currentLevel: number;
  correctStreak: number;
  memoryAvailable: boolean;
}): number {
  assertLearningAction("recommend-difficulty");
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
  expectedAnswer: string;
  acceptableAnswers?: readonly string[];
  nextLevel: number;
}): Promise<{
  questionId: string;
  level: number;
  correct: boolean;
  correctStreak: number;
  attemptCount: number;
}> {
  const normalizedAnswer = _input.answer.trim();
  if (
    !_input.childId ||
    !_input.topicId ||
    !normalizedAnswer ||
    !_input.expectedAnswer
  )
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
    const correct = checkAnswer(
      normalizedAnswer,
      _input.expectedAnswer,
      _input.acceptableAnswers,
    );
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

/** Returns per-topic detail for one child including accuracy. */
export function getTopicDetail(
  childId: string,
  topicId: string,
): {
  topicId: string;
  level: number;
  correctStreak: number;
  attempts: number;
  correct: number;
  accuracy: number;
  lastAttempt: string | null;
} | null {
  const progress = learningDb
    .prepare(
      "SELECT level, correct_streak, updated_at FROM learning_progress WHERE child_id = ? AND topic_id = ?",
    )
    .get(childId, topicId) as
    | { level: number; correct_streak: number; updated_at: string }
    | undefined;
  if (!progress) return null;
  const stats = learningDb
    .prepare(
      `SELECT COUNT(*) AS attempts, SUM(correct) AS correct FROM learning_attempts WHERE child_id = ? AND topic_id = ?`,
    )
    .get(childId, topicId) as { attempts: number; correct: number };
  const lastAttempt =
    (
      learningDb
        .prepare(
          "SELECT created_at FROM learning_attempts WHERE child_id = ? AND topic_id = ? ORDER BY created_at DESC LIMIT 1",
        )
        .get(childId, topicId) as { created_at: string } | undefined
    )?.created_at ?? null;
  return {
    topicId,
    level: progress.level,
    correctStreak: progress.correct_streak,
    attempts: stats.attempts,
    correct: stats.correct ?? 0,
    accuracy:
      stats.attempts > 0
        ? Math.round(((stats.correct ?? 0) / stats.attempts) * 100)
        : 0,
    lastAttempt,
  };
}

/** Returns aggregate progress suitable for a parent-facing summary. */
export function getParentProgressSummary(childId: string): {
  topics: Array<{
    topicId: string;
    level: number;
    attempts: number;
    correct: number;
    accuracy: number;
    lastAttempt: string | null;
  }>;
  totalAttempts: number;
  totalCorrect: number;
  overallAccuracy: number;
  recentAttempts: Array<{
    topicId: string;
    correct: boolean;
    levelBefore: number;
    levelAfter: number;
    createdAt: string;
  }>;
} {
  const topics = learningDb
    .prepare(
      `SELECT p.topic_id AS topicId, p.level AS level,
        COUNT(a.id) AS attempts, COALESCE(SUM(a.correct), 0) AS correct,
        MAX(a.created_at) AS lastAttempt
      FROM learning_progress p LEFT JOIN learning_attempts a
      ON a.child_id = p.child_id AND a.topic_id = p.topic_id
      WHERE p.child_id = ? GROUP BY p.topic_id, p.level`,
    )
    .all(childId) as Array<{
    topicId: string;
    level: number;
    attempts: number;
    correct: number;
    lastAttempt: string | null;
  }>;

  const topicsWithAccuracy = topics.map((t) => ({
    ...t,
    accuracy: t.attempts > 0 ? Math.round((t.correct / t.attempts) * 100) : 0,
  }));

  const totalAttempts = topicsWithAccuracy.reduce(
    (sum, t) => sum + t.attempts,
    0,
  );
  const totalCorrect = topicsWithAccuracy.reduce(
    (sum, t) => sum + t.correct,
    0,
  );

  const recentAttempts = learningDb
    .prepare(
      `SELECT topic_id AS topicId, correct, level_before AS levelBefore,
        level_after AS levelAfter, created_at AS createdAt
      FROM learning_attempts WHERE child_id = ?
      ORDER BY created_at DESC LIMIT 20`,
    )
    .all(childId) as Array<{
    topicId: string;
    correct: number;
    levelBefore: number;
    levelAfter: number;
    createdAt: string;
  }>;

  return {
    topics: topicsWithAccuracy,
    totalAttempts,
    totalCorrect,
    overallAccuracy:
      totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0,
    recentAttempts: recentAttempts.map((a) => ({
      topicId: a.topicId,
      correct: a.correct === 1,
      levelBefore: a.levelBefore,
      levelAfter: a.levelAfter,
      createdAt: a.createdAt,
    })),
  };
}

/** Returns the minimal audit representation of a learning event. */
export function redactLearningAudit(
  _event: Record<string, unknown>,
): Record<string, unknown> {
  return { event: _event.event ?? "learning-event" };
}
