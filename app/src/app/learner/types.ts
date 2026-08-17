import type { OdysseyTestA2uiDocument } from "../../a2ui/test-document";

export type FlatStandard = {
  id: string;
  standardCode: string;
  standardText: string;
  domain: string;
  subject: string;
  grade: string;
};

export type PracticeFeedback = { kind: "success" | "error"; message: string };

export type Mode = "practice" | "test";

export type AnswerResult = {
  correct: boolean;
  correctAnswer: string;
  solution: string[];
  hint: string;
  points: number;
  answeredDifficulty: number;
  testMode: boolean;
  testPosition: number;
  testTotal: number;
};

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
  interaction?: unknown;
  a2ui?: OdysseyTestA2uiDocument;
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

export type HistoryEntry = {
  kind: "practice" | "test";
  occurredAt: string;
  topicId?: string;
  correct?: boolean;
  status?: "completed" | "partial";
  score?: number;
  answeredQuestions?: number;
  totalQuestions?: number;
};
