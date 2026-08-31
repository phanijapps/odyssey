import type { QuestionGenerator } from "@odyssey/core";
import { isOllamaConfigured, requestOllamaLearningQuestion } from "./agent";

/**
 * The application's generation boundary as the practice engine expects it:
 * present only when the local model is configured, so an unconfigured app
 * serves the reviewed bank without ever calling out.
 */
export const ollamaQuestionGenerator: QuestionGenerator | null =
  isOllamaConfigured() ? requestOllamaLearningQuestion : null;
