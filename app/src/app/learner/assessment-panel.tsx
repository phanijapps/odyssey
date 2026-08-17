import { FormEvent } from "react";
import { OdysseyTestA2uiSurface } from "../test-a2ui-surface";
import type { OdysseyTestA2uiAction } from "../../a2ui/test-document";
import { MathText } from "@/components/math-text";
import { parseTextResponseInteraction } from "./question-interaction";
import {
  Assessment,
  AssessmentQuestion,
  AssessmentResult,
  FlatStandard,
} from "./types";

type AssessmentPanelProps = {
  allStandards: FlatStandard[];
  assessment: Assessment | null;
  assessmentQuestion: AssessmentQuestion | null;
  assessmentResult: AssessmentResult | null;
  answer: string;
  testError: string;
  testLoading: boolean;
  testSelectedIds: string[];
  onAnswerChange: (answer: string) => void;
  onA2uiSubmit: (action: OdysseyTestA2uiAction) => Promise<void>;
  onExit: () => void;
  onLoadActiveTest: (assessmentId: string) => void;
  onNewTest: () => void;
  onStart: () => void;
  onSubmitAnswer: (event: FormEvent<HTMLFormElement>) => void;
  onSwitchToPractice: () => void;
  onToggleSelectedSkill: (skill: FlatStandard) => void;
};

/** Renders server-owned assessment setup, active, recovery, and review states. */
export function AssessmentPanel({
  allStandards,
  assessment,
  assessmentQuestion,
  assessmentResult,
  answer,
  testError,
  testLoading,
  testSelectedIds,
  onAnswerChange,
  onA2uiSubmit,
  onExit,
  onLoadActiveTest,
  onNewTest,
  onStart,
  onSubmitAnswer,
  onSwitchToPractice,
  onToggleSelectedSkill,
}: AssessmentPanelProps) {
  return (
    <>
      <div className="practice-header">
        <div>
          <p className="eyebrow">ASSESSMENT</p>
          <h1 className="practice-skill">
            {assessment ? "Your math test" : "Build a mixed-skill test"}
          </h1>
          <p className="practice-desc">
            {assessment
              ? "Answers are reviewed together when you finish."
              : "Choose up to three skills, then begin a nine-question test."}
          </p>
        </div>
        {assessment && (
          <div className="practice-meta">
            <span className="test-progress">
              Question{" "}
              {assessmentQuestion?.ordinal ??
                assessment.questions.filter((q) => q.answered).length + 1}{" "}
              of 9
            </span>
            {assessment.status !== "active" && (
              <span className="score-badge">Score {assessment.score}</span>
            )}
            {assessment.status === "active" && (
              <button
                className="secondary-btn"
                onClick={onExit}
                disabled={testLoading}
              >
                Exit test
              </button>
            )}
          </div>
        )}
      </div>
      {!assessment ? (
        <div className="question-card">
          <div className="question-copy">
            <h2 className="question-text">Choose 1–3 skills</h2>
            <p className="practice-desc">
              Open Browse skills or search, then select the skills you want in
              this test.
            </p>
            <div className="test-breakdown">
              {testSelectedIds.length ? (
                testSelectedIds.map((id) => {
                  const skill = allStandards.find((item) => item.id === id);
                  return (
                    <button
                      key={id}
                      className="secondary-btn"
                      onClick={() => skill && onToggleSelectedSkill(skill)}
                    >
                      {skill?.standardCode} ×
                    </button>
                  );
                })
              ) : (
                <p className="loading-text">No skills selected yet.</p>
              )}
            </div>
            <button
              className="primary-button"
              onClick={onStart}
              disabled={!testSelectedIds.length || testLoading}
            >
              {testLoading ? "Starting…" : "Start test"}
            </button>
          </div>
        </div>
      ) : assessment.status !== "active" ? (
        <div className="question-card test-report">
          <div className="question-copy">
            <h2 className="practice-skill">
              {assessment.status === "partial"
                ? "Test saved as partial"
                : "Test complete!"}
            </h2>
            <p className="test-score-line">
              You scored <strong>{assessment.score}</strong> out of{" "}
              <strong>180</strong> points.
            </p>
            <div className="test-breakdown">
              {assessmentResult?.questions.map((item) => (
                <div key={item.ordinal} className="test-entry">
                  <strong>
                    Q{item.ordinal} · {item.correct ? "Correct" : "Not yet"} · +
                    {item.points}
                  </strong>
                  <p>
                    Correct answer: <MathText>{item.correctAnswer}</MathText>
                  </p>
                  {item.question.solution?.map((step, index) => (
                    <p key={index}>
                      <MathText>{step}</MathText>
                    </p>
                  ))}
                </div>
              ))}
            </div>
            <button className="primary-button" onClick={onNewTest}>
              New test
            </button>
            <button className="secondary-btn" onClick={onSwitchToPractice}>
              Back to practice
            </button>
          </div>
        </div>
      ) : assessment.questions.find((item) => !item.answered)
          ?.preparationStatus === "unavailable" ? (
        <div className="question-card">
          <div className="question-copy">
            <h2 className="question-text">This question needs another try.</h2>
            <p className="practice-desc">
              Your test has not advanced. Retry the same question when the local
              generator is ready.
            </p>
            <button
              className="primary-button"
              onClick={() => onLoadActiveTest(assessment.id)}
              disabled={testLoading}
            >
              Retry question
            </button>
          </div>
        </div>
      ) : assessmentQuestion ? (
        <div className="question-card">
          <div className="question-copy">
            {!assessmentQuestion.a2ui && (
              <h2 className="question-text">
                <MathText>{assessmentQuestion.question}</MathText>
              </h2>
            )}
            {assessmentQuestion.a2ui ? (
              <OdysseyTestA2uiSurface
                document={assessmentQuestion.a2ui}
                onSubmit={onA2uiSubmit}
              />
            ) : (
              <form onSubmit={onSubmitAnswer} className="answer-row">
                <input
                  className="answer-input"
                  value={answer}
                  onChange={(event) => onAnswerChange(event.target.value)}
                  maxLength={
                    parseTextResponseInteraction(assessmentQuestion.interaction)
                      ?.response.maxLength ?? 100
                  }
                  placeholder="Type your answer"
                  disabled={testLoading}
                  autoFocus
                />
                <button
                  className="primary-button"
                  type="submit"
                  disabled={testLoading || !answer.trim()}
                >
                  {testLoading ? "Saving…" : "Submit answer"}
                </button>
              </form>
            )}
            <p className="loading-text">
              Your answers and solutions appear when the test is complete.
            </p>
          </div>
          {assessmentQuestion.diagramSvg && (
            <div className="diagram-card">
              <img
                className="generated-diagram"
                src={`data:image/svg+xml,${encodeURIComponent(assessmentQuestion.diagramSvg)}`}
                alt="diagram"
              />
            </div>
          )}
        </div>
      ) : (
        <div className="empty-practice">
          <h2>Preparing your next question…</h2>
          <p>Your test stays in place while it loads.</p>
        </div>
      )}
      {testError && (
        <p className="error" role="alert">
          {testError}
        </p>
      )}
    </>
  );
}
