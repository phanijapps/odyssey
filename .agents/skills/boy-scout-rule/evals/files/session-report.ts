import "server-only";
import { learningDb } from "./db";

// Session report for the parent summary screen. Built in a hurry during the
// test-mode launch; it has grown and could use a proper restructure someday,
// but it is stable and every field is consumed by the parent app.

type GradedQuestion = {
  ordinal: number;
  correct: number | null;
  points: number | null;
  graded_at: string | null;
  planned_difficulty: number;
};

type SessionRow = {
  id: string;
  learner_id: string;
  subject: string;
  grade: string;
  status: string;
  score: number;
  created_at: string;
  completed_at: string | null;
};

export function buildParentReport(sessionId: string) {
  const session = learningDb
    .prepare("SELECT * FROM test_sessions WHERE id = ?")
    .get(sessionId) as SessionRow | undefined;
  if (!session) {
    return null;
  }
  const questions = learningDb
    .prepare(
      "SELECT ordinal, correct, points, graded_at, planned_difficulty FROM test_questions WHERE test_session_id = ? ORDER BY ordinal",
    )
    .all(sessionId) as GradedQuestion[];
  const graded = questions.filter((q) => q.correct !== null);
  const byDifficulty: Record<string, { asked: number; right: number }> = {};
  for (const q of graded) {
    const key = `level_${q.planned_difficulty}`;
    const slot = byDifficulty[key] ?? { asked: 0, right: 0 };
    slot.asked = slot.asked + 1;
    if (q.correct === 1) {
      slot.right = slot.right + 1;
    }
    byDifficulty[key] = slot;
  }
  const correctCount = graded.filter((q) => q.correct === 1).length;
  const ungraded = questions.length - graded.length;
  const minutes = session.completed_at
    ? Math.max(
        1,
        Math.round(
          (new Date(session.completed_at).getTime() -
            new Date(session.created_at).getTime()) /
            60000,
        ),
      )
    : null;
  const weakest = Object.entries(byDifficulty)
    .map(([key, v]) => ({ key, rate: v.right / v.asked }))
    .sort((a, b) => a.rate - b.rate)[0];
  const report = {
    session_id: session.id,
    learner_id: session.learner_id,
    subject: session.subject,
    grade: session.grade,
    status: session.status,
    score: session.score,
    correct_count: correctCount,
    ungraded_count: ungraded,
    minutes_spent: minutes,
    hardest_level: weakest ? weakest.key : null,
    hardest_level_rate: weakest ? Math.round(weakest.rate * 100) / 100 : null,
    generated_at: new Date().toISOString(),
  };
  return report;
}
