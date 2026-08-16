import { FormEvent } from "react";
import { MathText } from "@/components/math-text";
import { AnswerResult, FlatStandard, PracticeFeedback } from "./types";

type PracticePanelProps = {
  activeSkill: FlatStandard;
  answer: string;
  correctStreak: number;
  diagramSvg: string | null;
  feedback: PracticeFeedback | null;
  isLoadingQuestion: boolean;
  isSubmittingAnswer: boolean;
  poolDifficulty: number;
  poolPos: number;
  poolTotal: number;
  question: string;
  questionFailed: boolean;
  result: AnswerResult | null;
  testDone: boolean;
  testLog: { correct: boolean; points: number; difficulty: number }[];
  testScore: number;
  onAnswerChange: (answer: string) => void;
  onNextQuestion: () => void;
  onRetry: () => void;
  onStartNewTest: () => void;
  onSubmitAnswer: (event: FormEvent<HTMLFormElement>) => void;
  onSwitchToPractice: () => void;
};

/** Renders the adaptive Practice question and immediate feedback flow. */
export function PracticePanel({
  activeSkill,
  answer,
  correctStreak,
  diagramSvg,
  feedback,
  isLoadingQuestion,
  isSubmittingAnswer,
  poolDifficulty,
  poolPos,
  poolTotal,
  question,
  questionFailed,
  result,
  testDone,
  testLog,
  testScore,
  onAnswerChange,
  onNextQuestion,
  onRetry,
  onStartNewTest,
  onSubmitAnswer,
  onSwitchToPractice,
}: PracticePanelProps) {
  return (
    <>
      <div className="practice-header">
        <div>
          <p className="eyebrow">{activeSkill.subject.toUpperCase()}</p>
          <h1 className="practice-skill">{activeSkill.standardCode}</h1>
          <p className="practice-desc">{activeSkill.standardText}</p>
        </div>
        <div className="practice-meta">
          {poolTotal > 0 && (
            <div className="pool-bar">
              {Array.from({ length: poolTotal }).map((_, i) => (
                <div
                  key={i}
                  className={`pool-dot ${i < poolPos ? "done" : i === poolPos ? "current" : ""}`}
                />
              ))}
            </div>
          )}
          <span className={`diff-badge diff-${poolDifficulty}`}>
            {poolDifficulty === 1
              ? "Building up"
              : poolDifficulty === 2
                ? "On track"
                : "Challenge"}
          </span>
          <span className="streak-badge">🔥 {correctStreak}</span>
        </div>
      </div>

      {testDone ? (
        <div className="question-card test-report">
          <div className="question-copy">
            <h2 className="practice-skill">Test complete!</h2>
            <p className="test-score-line">
              You scored <strong>{testScore}</strong> out of{" "}
              <strong>180</strong> points.
            </p>
            <div className="test-breakdown">
              {testLog.map((entry, i) => (
                <div key={i} className="test-entry">
                  <span
                    className={entry.correct ? "kg-pred good" : "kg-pred bad"}
                  >
                    Q{i + 1} · Level {entry.difficulty} ·{" "}
                    {entry.correct ? "✓" : "✗"} +{entry.points}
                  </span>
                </div>
              ))}
            </div>
            <button className="primary-button" onClick={onStartNewTest}>
              Take a new test
            </button>
            <button className="secondary-btn" onClick={onSwitchToPractice}>
              Back to practice
            </button>
          </div>
        </div>
      ) : (
        <div className="question-card">
          <div className="question-copy">
            {questionFailed ? (
              <div className="retry-panel">
                <p className="retry-message">
                  We couldn&rsquo;t generate a question for this skill just now.
                  The local model may be busy — try again.
                </p>
                <button className="primary-button" onClick={onRetry}>
                  Try again
                </button>
              </div>
            ) : (
              <>
                <h2 className="question-text">
                  <MathText>{question}</MathText>
                </h2>
                {isLoadingQuestion ? (
                  <p className="loading-text">Loading your question…</p>
                ) : result ? (
                  <>
                    <div
                      className={`solution-panel ${result.correct ? "good" : "bad"}`}
                    >
                      <p className="solution-title">
                        {result.correct
                          ? "Correct! Here's how it works:"
                          : `The correct answer is ${result.correctAnswer}`}
                      </p>
                      <ol className="solution-steps">
                        {result.solution.map((step, i) => (
                          <li key={i}>
                            <MathText>{step}</MathText>
                          </li>
                        ))}
                      </ol>
                    </div>
                    <button
                      className="primary-button next-btn"
                      onClick={onNextQuestion}
                    >
                      Next question →
                    </button>
                  </>
                ) : (
                  <form onSubmit={onSubmitAnswer} className="answer-row">
                    <input
                      className="answer-input"
                      value={answer}
                      onChange={(event) => onAnswerChange(event.target.value)}
                      placeholder="Type your answer"
                      disabled={isSubmittingAnswer}
                      autoFocus
                    />
                    <button
                      className="primary-button"
                      type="submit"
                      disabled={isSubmittingAnswer || !answer.trim()}
                    >
                      Check
                    </button>
                  </form>
                )}
                {feedback && !result && (
                  <p className={`feedback-${feedback.kind}`} role="status">
                    <MathText>{feedback.message}</MathText>
                  </p>
                )}
              </>
            )}
          </div>
          {diagramSvg && (
            <div className="diagram-card">
              <img
                className="generated-diagram"
                src={`data:image/svg+xml,${encodeURIComponent(diagramSvg)}`}
                alt="diagram"
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
