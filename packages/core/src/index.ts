/** Public API of the Odyssey learning core — pure domain, zero framework. */
export {
  questionBank,
  type QuestionBankEntry,
} from "./algorithms/question-bank";
export { checkAnswer } from "./algorithms/grading";
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
} from "./algorithms/adaptive-pool";
export {
  learnerQuestionInteractionSchema,
  textResponseInteraction,
  multipleChoiceInteraction,
  trueFalseInteraction,
  type LearnerQuestionInteraction,
} from "./validators/question-interactions";
export {
  validateLearningPayload,
  sanitizeGeneratedDiagramSvg,
  serializeSafeDiagnostic,
} from "./validators/payloads";
export {
  parseCurriculumCatalog,
  getSeedCurriculumCatalog,
  type CurriculumCatalog,
  type CurriculumTopic,
} from "./curriculum/catalog";
// The reviewed catalog data ships with the core so the db package can seed
// from it without a private path.
export { default as ohioCatalog } from "./curriculum/data/ohio-catalog.json";
