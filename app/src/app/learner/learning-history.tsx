import { HistoryEntry } from "./types";

type LearningHistoryProps = { history: HistoryEntry[] };

/** Renders the learner-scoped practice and assessment summaries. */
export function LearningHistory({ history }: LearningHistoryProps) {
  return (
    <section className="skill-browser" aria-label="Learning history">
      <div className="browser-domain">
        <p className="browser-domain-header">Learning history</p>
        {history.length ? (
          history.map((entry, index) => (
            <div
              className="test-entry"
              key={`${entry.kind}-${entry.occurredAt}-${index}`}
            >
              <strong>
                {entry.kind === "test" ? `Test · ${entry.status}` : "Practice"}
              </strong>
              <span>
                {" "}
                {entry.kind === "test"
                  ? `${entry.answeredQuestions ?? 0} /${entry.totalQuestions ?? 9} answered · ${entry.score ?? 0} points`
                  : `${entry.topicId ?? "skill"} · ${entry.correct ? "correct" : "try again"}`}
              </span>
            </div>
          ))
        ) : (
          <p className="loading-text">No learning history yet.</p>
        )}
      </div>
    </section>
  );
}
