import type { LearnerQuestionInteraction } from "@odyssey/practice-engine";

export type Assessment = {
  id: string;
  status: "active" | "completed" | "partial";
  score: number;
  questions: {
    ordinal: number;
    answered: boolean;
    preparationStatus?: "pending" | "preparing" | "ready" | "unavailable";
  }[];
};

export type AssessmentQuestion = {
  ordinal: number;
  total: number;
  question: string;
  assignmentToken: string;
  interaction?: LearnerQuestionInteraction;
  diagramSvg?: string;
};

export type AssessmentResult = {
  questions: {
    ordinal: number;
    correct: boolean;
    points: number;
    correctAnswer: string;
    question: { solution?: string[] };
  }[];
};

export type AssessmentResponse = {
  assessment: Assessment;
  question?: AssessmentQuestion;
  result?: AssessmentResult;
};
