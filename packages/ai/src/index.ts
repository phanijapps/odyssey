/** Public API of the Odyssey AI boundary — bounded, validated, tool-free. */
export {
  requestOllamaLearningQuestion,
  isOllamaConfigured,
  validateGeneratedLearningResponse,
  validateGeneratedQuestionText,
  parseOpenAICompletionJson,
  assertAgentRequestBudget,
  buildAgentProfileData,
  probeOllamaModel,
  redactAgentAudit,
} from "./agent";
export { getOllamaOpenAIUrl } from "./providers/ollama-openai-url";
export { completeWithLocalOllama } from "./providers/pi-completion";
export { getGenerationInstruction } from "./prompts/generation-instruction";
export { ollamaQuestionGenerator } from "./generator";
