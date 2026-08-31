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
