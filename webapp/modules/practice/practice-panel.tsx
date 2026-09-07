import { FormEvent } from "react";
import { MathText } from "@/components/math-text";
import { InteractionAnswer } from "@/components/interaction-answer";
import type { LearnerQuestionInteraction } from "@odyssey/core";
import { AnswerResult, FlatStandard, PracticeFeedback } from "./types";

type PracticePanelProps = {
  activeSkill: FlatStandard;
  answer: string;
  interaction: LearnerQuestionInteraction | null;
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
  poolExhausted: boolean;
  result: AnswerResult | null;
  onAnswerChange: (answer: string) => void;
  onNextQuestion: () => void;
  onRetry: () => void;
  onSubmitAnswer: (event: FormEvent<HTMLFormElement>) => void;
};

/** Renders the adaptive Practice question and immediate feedback flow. */
export function PracticePanel({
  activeSkill,
  answer,
  interaction,
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
  poolExhausted,
  result,
  onAnswerChange,
  onNextQuestion,
  onRetry,
  onSubmitAnswer,
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
            <div>
              <span>
                {poolExhausted
                  ? "Round complete"
                  : `Question ${poolPos} of ${poolTotal}`}
              </span>
              <div className="pool-bar" aria-hidden="true">
                {Array.from({ length: poolTotal }).map((_, i) => (
                  <div
                    key={i}
                    className={`pool-dot ${i < poolPos - (result || poolExhausted ? 0 : 1) ? "done" : i === poolPos - 1 ? "current" : ""}`}
                  />
                ))}
              </div>
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

      <div className="question-card">
        <div className="question-copy">
          {poolExhausted ? (
            <div className="retry-panel">
              <h2>Practice round complete</h2>
              <p>You practiced {poolPos} questions. Ready for another round?</p>
              <button className="primary-button" onClick={onRetry}>
                Start another round
              </button>
            </div>
          ) : questionFailed ? (
            <div className="retry-panel">
              <p className="retry-message">
                We couldn&rsquo;t load a question for this skill. Try again in a
                moment.
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
                <p className="loading-text" role="status">
                  Getting your practice ready. You can choose another skill
                  while you wait.
                </p>
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
              ) : interaction ? (
                <form onSubmit={onSubmitAnswer} className="answer-row">
                  <InteractionAnswer
                    interaction={interaction}
                    value={answer}
                    onChange={onAnswerChange}
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
              ) : (
                <form onSubmit={onSubmitAnswer} className="answer-row">
                  <input
                    className="answer-input"
                    value={answer}
                    maxLength={100}
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
    </>
  );
}
