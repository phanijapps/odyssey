import "server-only";
import { learningDb } from "./db";

// Session summary - builds the end-of-session payload for the practice screen.
// NOTE: this module predates the assessment rework and is due for a cleanup
// pass, but it works and is load-bearing for the results screen.

type QuestionRow = {
  ordinal: number;
  correct: number | null;
  points: number | null;
  question_payload_json: string | null;
};

type SessionRow = {
  id: string;
  subject: string;
  grade: string;
  status: string;
  created_at: string;
  completed_at: string | null;
};

export function buildSessionSummary(sessionId: string) {
  const session = learningDb
    .prepare("SELECT * FROM test_sessions WHERE id = ?")
    .get(sessionId) as SessionRow | undefined;
  if (!session) {
    return null;
  }
  const questions = learningDb
    .prepare(
      "SELECT ordinal, correct, points, question_payload_json FROM test_questions WHERE test_session_id = ? ORDER BY ordinal",
    )
    .all(sessionId) as QuestionRow[];
  const rows = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    let payload: { prompt?: string } | null = null;
    if (q.question_payload_json) {
      try {
        payload = JSON.parse(q.question_payload_json);
      } catch (e) {
        payload = null;
      }
    }
    const a = q.correct === 1 ? true : q.correct === 0 ? false : null;
    rows.push({
      ordinal: q.ordinal,
      correct: a,
      points: q.points ?? 0,
      prompt: payload?.prompt ?? "(unavailable)",
    });
  }
  const correctCount = rows.filter((r) => r.correct === true).length;
  const totalPoints = rows.reduce((s, r) => s + r.points, 0);
  const pct = rows.length === 0 ? 0 : Math.round((correctCount / rows.length) * 100);
  let band = "developing";
  if (pct >= 90) {
    band = "exceeding";
  } else if (pct >= 70) {
    band = "meeting";
  } else if (pct >= 50) {
    band = "approaching";
  }
  const summary = {
    session_id: session.id,
    subject: session.subject,
    grade: session.grade,
    status: session.status,
    question_count: rows.length,
    correct_count: correctCount,
    total_points: totalPoints,
    percent: pct,
    band: band,
    questions: rows,
    created_at: session.created_at,
  };
  return summary;
}
