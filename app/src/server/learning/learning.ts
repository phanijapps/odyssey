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

type LearningProgressRow = {
  level: number;
  correct_streak: number;
  updated_at: string;
};

/** Reads the one server-owned progression record for a child and topic. */
function loadLearningProgress(
  childId: string,
  topicId: string,
): LearningProgressRow | undefined {
  return learningDb
    .prepare(
      "SELECT level, correct_streak, updated_at FROM learning_progress WHERE child_id = ? AND topic_id = ?",
    )
    .get(childId, topicId) as LearningProgressRow | undefined;
}

/** Counts the persisted practice attempts for one child and topic. */
function countLearningAttempts(childId: string, topicId: string): number {
  return (
    learningDb
      .prepare(
        "SELECT COUNT(*) AS count FROM learning_attempts WHERE child_id = ? AND topic_id = ?",
      )
      .get(childId, topicId) as { count: number }
  ).count;
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
    const current = loadLearningProgress(_input.childId, _input.topicId);
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
    const attemptCount = countLearningAttempts(_input.childId, _input.topicId);
    return {
      questionId: `question-${Date.now()}`,
      level: nextLevel,
      correct,
      correctStreak,
      attemptCount,
    };
  });
}

type PracticePoolQuestion = {
  id: string;
  answer: string;
  acceptableAnswers: readonly string[];
  hint: string;
  solution: readonly string[];
  difficulty: number;
};

type StoredPracticePool = {
  topicId: string;
  questions: readonly PracticePoolQuestion[];
  currentDifficulty: number;
  activeAssignment?: { questionId: string; token: string };
  [key: string]: unknown;
};

/** Parses only the stored fields needed to consume one Practice assignment. */
function activePracticeQuestion(
  rawPool: string,
  topicId: string,
  assignmentToken: string,
): { pool: StoredPracticePool; question: PracticePoolQuestion } {
  let pool: StoredPracticePool;
  try {
    pool = JSON.parse(rawPool) as StoredPracticePool;
  } catch {
    throw new Error("Practice assignment unavailable");
  }
  const assignment = pool.activeAssignment;
  if (
    !pool ||
    typeof pool !== "object" ||
    pool.topicId !== topicId ||
    (pool.mode !== undefined && pool.mode !== "practice") ||
    !assignment ||
    assignment.token !== assignmentToken ||
    typeof assignment.questionId !== "string" ||
    !Array.isArray(pool.questions) ||
    !Number.isInteger(pool.currentDifficulty) ||
    pool.currentDifficulty < 1 ||
    pool.currentDifficulty > 3
  )
    throw new Error("Practice assignment unavailable");
  const question = pool.questions.find(
    (candidate) => candidate.id === assignment.questionId,
  );
  if (
    !question ||
    typeof question.answer !== "string" ||
    question.answer.length === 0 ||
    !Array.isArray(question.acceptableAnswers) ||
    !question.acceptableAnswers.every(
      (answer: unknown) => typeof answer === "string",
    ) ||
    !Number.isInteger(question.difficulty) ||
    question.difficulty < 1 ||
    question.difficulty > 3
  )
    throw new Error("Practice assignment unavailable");
  return { pool, question };
}

/**
 * Consumes the one active server-issued assignment and persists its learning
 * result in the same transaction. The pool write is conditional on the exact
 * stored representation so replay, stale prefetches, and concurrent submits
 * cannot overwrite an accepted result or create a second attempt.
 */
export function submitPracticeAssignment(input: {
  childId: string;
  sessionTokenHash: string;
  topicId: string;
  answer: string;
  assignmentToken: string;
}): {
  questionId: string;
  level: number;
  correct: boolean;
  correctStreak: number;
  attemptCount: number;
  hint: string;
  solution: readonly string[];
  correctAnswer: string;
  answeredDifficulty: number;
  nextPracticeDifficulty: 1 | 2 | 3;
  poolProgress: { position: number; total: number; difficulty: 1 | 2 | 3 };
} {
  const normalizedAnswer = input.answer.trim();
  if (
    !input.childId ||
    !input.sessionTokenHash ||
    !input.topicId ||
    !normalizedAnswer ||
    !/^[A-Za-z0-9_-]{32,}$/.test(input.assignmentToken)
  )
    throw new Error("Invalid practice answer");

  return withLearningTransaction(() => {
    const session = learningDb
      .prepare(
        "SELECT question_pool FROM auth_sessions WHERE token_hash = ? AND child_id = ?",
      )
      .get(input.sessionTokenHash, input.childId) as
      | { question_pool: string | null }
      | undefined;
    if (!session?.question_pool)
      throw new Error("Practice assignment unavailable");
    const { pool, question } = activePracticeQuestion(
      session.question_pool,
      input.topicId,
      input.assignmentToken,
    );

    const current = loadLearningProgress(input.childId, input.topicId);
    const level = current?.level ?? 1;
    const correct = checkAnswer(
      normalizedAnswer,
      question.answer,
      question.acceptableAnswers,
    );
    const streak = correct ? (current?.correct_streak ?? 0) + 1 : 0;
    const nextLevel = recommendNextLevel({
      currentLevel: level,
      correctStreak: streak,
      memoryAvailable: false,
    });
    const correctStreak = nextLevel > level ? 0 : streak;
    const createdAt = new Date().toISOString();
    const attemptWrite = createLearningAttemptWrite({
      childId: input.childId,
      topicId: input.topicId,
      correct,
      levelBefore: level,
      levelAfter: nextLevel,
      createdAt,
    });
    learningDb.prepare(attemptWrite.sql).run(...attemptWrite.parameters);
    learningDb
      .prepare(
        `INSERT INTO learning_progress (child_id, topic_id, level, correct_streak, updated_at)
         VALUES (?, ?, ?, ?, ?) ON CONFLICT(child_id, topic_id) DO UPDATE SET
           level=excluded.level, correct_streak=excluded.correct_streak,
           updated_at=excluded.updated_at`,
      )
      .run(input.childId, input.topicId, nextLevel, correctStreak, createdAt);

    const nextPracticeDifficulty = (
      correct
        ? Math.min(3, pool.currentDifficulty + 1)
        : Math.max(1, pool.currentDifficulty - 1)
    ) as 1 | 2 | 3;
    const updatedPool = {
      ...pool,
      currentDifficulty: nextPracticeDifficulty,
      activeAssignment: undefined,
    };
    const consumed = learningDb
      .prepare(
        `UPDATE auth_sessions SET question_pool = ?
         WHERE token_hash = ? AND child_id = ? AND question_pool = ?`,
      )
      .run(
        JSON.stringify(updatedPool),
        input.sessionTokenHash,
        input.childId,
        session.question_pool,
      );
    if (consumed.changes !== 1)
      throw new Error("Practice assignment unavailable");

    return {
      questionId: question.id,
      level: nextLevel,
      correct,
      correctStreak,
      attemptCount: countLearningAttempts(input.childId, input.topicId),
      hint: question.hint,
      solution: question.solution,
      correctAnswer: question.answer,
      answeredDifficulty: question.difficulty,
      nextPracticeDifficulty,
      poolProgress: {
        position:
          typeof pool.batchPosition === "number" ? pool.batchPosition : 0,
        total: typeof pool.batchSize === "number" ? pool.batchSize : 0,
        difficulty: nextPracticeDifficulty,
      },
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
  const progress = loadLearningProgress(childId, topicId);
  if (!progress) return null;
  const attemptCount = countLearningAttempts(childId, topicId);
  return {
    level: progress.level,
    correctStreak: progress.correct_streak,
    attemptCount,
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
  const progress = loadLearningProgress(childId, topicId);
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
/** A redacted, learner-scoped timeline entry for the compact History view. */
export type LearnerHistoryEntry =
  | {
      readonly kind: "practice";
      readonly attemptId: number;
      readonly topicId: string;
      readonly correct: boolean;
      readonly levelBefore: number;
      readonly levelAfter: number;
      readonly occurredAt: string;
    }
  | {
      readonly kind: "test";
      readonly assessmentId: string;
      readonly subject: string;
      readonly grade: string;
      readonly status: "completed" | "partial";
      readonly score: number;
      readonly answeredQuestions: number;
      readonly totalQuestions: number;
      readonly occurredAt: string;
    };

/**
 * Lists recent practice attempts and terminal test summaries for one learner.
 * This read-only projection intentionally excludes test answers and does not
 * consult or update adaptive progress.
 */
export function getLearnerHistory(childId: string): LearnerHistoryEntry[] {
  if (!childId) throw new Error("Learner history unavailable");
  const rows = learningDb
    .prepare(
      `SELECT 'practice' AS kind, id AS attemptId, topic_id AS topicId,
        correct, level_before AS levelBefore, level_after AS levelAfter,
        created_at AS occurredAt,
        NULL AS assessmentId, NULL AS subject, NULL AS grade, NULL AS status,
        NULL AS score, NULL AS answeredQuestions, NULL AS totalQuestions
       FROM learning_attempts WHERE child_id = ?
       UNION ALL
       SELECT 'test' AS kind, NULL AS attemptId, NULL AS topicId,
        NULL AS correct, NULL AS levelBefore, NULL AS levelAfter,
        completed_at AS occurredAt, id AS assessmentId, subject, grade, status,
        score,
        (SELECT COUNT(*) FROM test_questions q WHERE q.test_session_id = test_sessions.id
          AND q.graded_at IS NOT NULL) AS answeredQuestions,
        (SELECT COUNT(*) FROM test_questions q WHERE q.test_session_id = test_sessions.id)
          AS totalQuestions
       FROM test_sessions
       WHERE learner_id = ? AND status IN ('completed', 'partial')
         AND completed_at IS NOT NULL
       ORDER BY occurredAt DESC LIMIT 50`,
    )
    .all(childId, childId) as Array<{
    kind: "practice" | "test";
    attemptId: number | null;
    topicId: string | null;
    correct: number | null;
    levelBefore: number | null;
    levelAfter: number | null;
    occurredAt: string;
    assessmentId: string | null;
    subject: string | null;
    grade: string | null;
    status: "completed" | "partial" | null;
    score: number | null;
    answeredQuestions: number | null;
    totalQuestions: number | null;
  }>;
  return rows.map((row) => {
    if (row.kind === "practice")
      return {
        kind: "practice",
        attemptId: row.attemptId!,
        topicId: row.topicId!,
        correct: row.correct === 1,
        levelBefore: row.levelBefore!,
        levelAfter: row.levelAfter!,
        occurredAt: row.occurredAt,
      };
    return {
      kind: "test",
      assessmentId: row.assessmentId!,
      subject: row.subject!,
      grade: row.grade!,
      status: row.status!,
      score: row.score!,
      answeredQuestions: row.answeredQuestions!,
      totalQuestions: row.totalQuestions!,
      occurredAt: row.occurredAt,
    };
  });
}

/** Returns the minimal audit representation of a learning event. */
export function redactLearningAudit(
  _event: Record<string, unknown>,
): Record<string, unknown> {
  return { event: _event.event ?? "learning-event" };
}
