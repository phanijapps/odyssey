import "server-only";
import { learningDb } from "./db";

// Builds the CSV a parent downloads from the session results screen.
// One function end to end: fetches the session, validates it is exportable,
// computes the summary stats, assembles the CSV rows, and appends the footer.

type SessionRow = {
  id: string;
  subject: string;
  grade: string;
  status: string;
};

type QuestionRow = {
  ordinal: number;
  correct: number | null;
  points: number | null;
};

export function exportSessionCsv(sessionId: string): string {
  const session = learningDb
    .prepare("SELECT id, subject, grade, status FROM test_sessions WHERE id = ?")
    .get(sessionId) as SessionRow | undefined;
  if (!session) {
    throw new Error("session not found: " + sessionId);
  }
  if (session.status !== "completed") {
    throw new Error("session not exportable until completed");
  }
  const questions = learningDb
    .prepare(
      "SELECT ordinal, correct, points FROM test_questions WHERE test_session_id = ? ORDER BY ordinal",
    )
    .all(sessionId) as QuestionRow[];
  const correctCount = questions.filter((q) => q.correct === 1).length;
  const percent =
    questions.length === 0
      ? 0
      : Math.round((correctCount / questions.length) * 100);
  let csv = "ordinal,correct,points\n";
  for (const q of questions) {
    csv += q.ordinal + "," + (q.correct ?? "-") + "," + (q.points ?? 0) + "\n";
  }
  csv +=
    "# " +
    session.subject +
    " grade " +
    session.grade +
    ": " +
    correctCount +
    "/" +
    questions.length +
    " (" +
    percent +
    "%)\n";
  return csv;
}
