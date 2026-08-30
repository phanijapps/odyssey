"use client";

import type { LearnerQuestionInteraction } from "../server/learning/question-interactions";

type InteractionAnswerProps = {
  interaction: LearnerQuestionInteraction;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
};

/**
 * Renders one server-issued, zod-validated learner interaction. The server
 * owns correctness; this component only collects the response value.
 */
export function InteractionAnswer({
  interaction,
  value,
  onChange,
  disabled = false,
  autoFocus = false,
}: InteractionAnswerProps) {
  if (interaction.type === "multiple-choice") {
    return (
      <fieldset className="interaction-options" disabled={disabled}>
        {interaction.options.map((option) => (
          <label key={option} className="interaction-option">
            <input
              type="radio"
              name="interaction-answer"
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              disabled={disabled}
            />
            <span>{option}</span>
          </label>
        ))}
      </fieldset>
    );
  }

  if (interaction.type === "true-false") {
    return (
      <fieldset className="interaction-options" disabled={disabled}>
        {(["true", "false"] as const).map((option) => (
          <label key={option} className="interaction-option">
            <input
              type="radio"
              name="interaction-answer"
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              disabled={disabled}
            />
            <span>{option === "true" ? "True" : "False"}</span>
          </label>
        ))}
      </fieldset>
    );
  }

  return (
    <input
      className="answer-input"
      type="text"
      value={value}
      maxLength={interaction.response.maxLength}
      placeholder="Your answer"
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      autoFocus={autoFocus}
    />
  );
}
