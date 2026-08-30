/** Public API of the Odyssey practice engine. */
export { questionBank, type QuestionBankEntry } from "./question-bank";
export {
  learnerQuestionInteractionSchema,
  textResponseInteraction,
  multipleChoiceInteraction,
  trueFalseInteraction,
  type LearnerQuestionInteraction,
} from "./question-interactions";
export { checkAnswer } from "./grading";
export {
  reviewedSampleForStandard,
  generateQuestionPool,
  createQuestionPool,
  generateLazyQuestion,
  prefetchNextQuestion,
  selectNextQuestion,
  selectByPlan,
  adjustDifficulty,
  hasMoreQuestions,
  poolProgress,
  buildTestPlan,
  pointsForDifficulty,
  type Difficulty,
  type PoolQuestion,
  type PoolMode,
  type QuestionPool,
  type QuestionGenerator,
  type GeneratedQuestion,
} from "./adaptive-pool";
