import { sanitizeGeneratedDiagramSvg } from "@odyssey/core";
import { completeWithLocalOllama } from "./providers/pi-completion";
import { getOllamaOpenAIUrl } from "./providers/ollama-openai-url";
import { getGenerationInstruction } from "./prompts/generation-instruction";

export { getOllamaOpenAIUrl } from "./providers/ollama-openai-url";

/** Runs the local Ollama integration to generate a fresh question with its answer. */
export async function requestOllamaLearningQuestion(input: {
  topicId: string;
  level: number;
  profileContext?: unknown;
  standards?: readonly { standardCode: string; standardText: string }[];
}): Promise<{
  question: string;
  answer: string;
  acceptableAnswers: string[];
  hint: string;
  solution: string[];
  diagramSvg: string;
}> {
  assertOllamaIntegrationConfiguration();
  if (!Number.isInteger(input.level) || input.level < 1 || input.level > 13)
    throw new Error("Invalid learning request");
  const profileData = input.profileContext
    ? buildAgentProfileData(input.profileContext)
    : null;
  assertAgentRequestBudget({
    requestCount: 1,
    timeoutMs: 15_000,
    retryCount: 0,
    maxTokens: 2_048,
    maxCostUsd: 0,
  });
  const content = await completeWithLocalOllama({
    systemPrompt: getGenerationInstruction(input.topicId, input.standards),
    messages: [
      input.standards?.length
        ? `Practice skill: ${input.standards[0].standardCode} — ${input.standards[0].standardText} (difficulty ${input.level}).`
        : `Topic: ${input.topicId} (difficulty ${input.level}). <learning-data>${JSON.stringify(
            {
              topicId: input.topicId,
              level: input.level,
            },
          )}</learning-data>`,
      ...(profileData ? [profileData.content] : []),
    ],
    timeoutMs: 15_000,
    maxTokens: 2_048,
  });
  const output = validateGeneratedLearningResponse(
    parseOpenAICompletionJson(assertOllamaCompletionContentLimit(content)),
  );
  const safeDiagram = sanitizeGeneratedDiagramSvg(output.diagramSvg);
  return {
    question: output.question,
    answer: output.answer,
    acceptableAnswers: output.acceptableAnswers,
    hint: output.hint,
    solution: output.solution,
    diagramSvg: safeDiagram,
  };
}

/** Enforces the exact provider response schema before any child-visible sink. */
export function validateGeneratedLearningResponse(_output: unknown): {
  question: string;
  answer: string;
  acceptableAnswers: string[];
  hint: string;
  solution: string[];
  diagramSvg: string;
} {
  if (!_output || typeof _output !== "object" || Array.isArray(_output))
    throw new Error("Invalid Ollama response");
  const output = _output as Record<string, unknown>;
  const allowed = [
    "question",
    "answer",
    "acceptableAnswers",
    "hint",
    "solution",
    "diagramSvg",
  ];
  if (
    !Object.keys(output).every((key) => allowed.includes(key)) ||
    Object.keys(output).length !== allowed.length ||
    typeof output.question !== "string" ||
    typeof output.answer !== "string" ||
    !Array.isArray(output.acceptableAnswers) ||
    !output.acceptableAnswers.every((v) => typeof v === "string") ||
    typeof output.hint !== "string" ||
    !Array.isArray(output.solution) ||
    output.solution.length < 1 ||
    output.solution.length > 5 ||
    !output.solution.every((v) => typeof v === "string") ||
    typeof output.diagramSvg !== "string"
  )
    throw new Error("Invalid Ollama response");
  validateGeneratedQuestionText(output.question);
  if (!output.answer.trim()) throw new Error("Invalid generated answer");
  return {
    question: output.question,
    answer: output.answer,
    acceptableAnswers: output.acceptableAnswers,
    hint: output.hint,
    solution: output.solution.map((s: string) => s.slice(0, 200)),
    diagramSvg: output.diagramSvg,
  };
}

/** Rejects provider question text that is unsafe or too short to be meaningful. */
export function validateGeneratedQuestionText(_question: string): void {
  const question = _question.trim();
  if (
    question.length < 20 ||
    question.length > 400 ||
    /[<>]|\b(ignore|instruction|system message|assistant|prompt)\b/i.test(
      question,
    )
  )
    throw new Error("Invalid generated question");
}

/** Retains the legacy response-size boundary before parsing model JSON. */
function assertOllamaCompletionContentLimit(content: string): string {
  if (content.length > 8_192) throw new Error("Invalid Ollama response");
  return content;
}

/** Parses a complete JSON response, stripping markdown fences if present.
 *  Recovers output truncated by the token ceiling by closing the dangling
 *  string and object — the question and answer live early in the payload. */
export function parseOpenAICompletionJson(content: string): unknown {
  const trimmed = content.trim();
  const stripped = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    return JSON.parse(stripped);
  } catch {
    const repaired = stripped.replace(/,$/, "");
    const closed = repaired + '"}';
    return JSON.parse(closed);
  }
}

function assertOllamaIntegrationConfiguration(): void {
  if (
    process.env.OLLAMA_INTEGRATION !== "1" ||
    process.env.PI_PROVIDER !== "ollama" ||
    !process.env.PI_MODEL
  )
    throw new Error("Ollama integration is disabled");
  getOllamaOpenAIUrl();
}

/** Returns true when the local Ollama integration is configured and enabled. */
export function isOllamaConfigured(): boolean {
  return (
    process.env.OLLAMA_INTEGRATION === "1" &&
    process.env.PI_PROVIDER === "ollama" &&
    typeof process.env.PI_MODEL === "string" &&
    process.env.PI_MODEL.length > 0
  );
}

/** Rejects an agent request that exceeds the configured runtime budget. */
export function assertAgentRequestBudget(_budget: {
  requestCount: number;
  timeoutMs: number;
  retryCount: number;
  maxTokens: number;
  maxCostUsd: number;
}): void {
  if (
    _budget.requestCount > 1 ||
    _budget.retryCount > 1 ||
    _budget.timeoutMs > 15_000 ||
    _budget.maxTokens > 4_096 ||
    _budget.maxCostUsd > 0.02
  ) {
    throw new Error("Agent budget exceeded");
  }
}

/** Encodes validated profile context as delimited data for the model request. */
export function buildAgentProfileData(_profileContext: unknown): {
  content: string;
} {
  if (
    !_profileContext ||
    typeof _profileContext !== "object" ||
    "instruction" in _profileContext
  )
    throw new Error("Invalid profile context");
  const input = _profileContext as Record<string, unknown>;
  const allowed = [
    "topicId",
    "acceptedLevel",
    "correct",
    "progressState",
    "provenanceVersion",
    "vocabularyVersion",
  ];
  if (
    Object.keys(input).some((key) => !allowed.includes(key)) ||
    !allowed.every((key) => key in input) ||
    !Number.isInteger(input.acceptedLevel) ||
    Number(input.acceptedLevel) < 1 ||
    Number(input.acceptedLevel) > 13 ||
    typeof input.correct !== "boolean" ||
    !["new", "practicing", "proficient"].includes(
      String(input.progressState),
    ) ||
    input.provenanceVersion !== "v1" ||
    input.vocabularyVersion !== "v1"
  )
    throw new Error("Invalid profile context");
  const data = JSON.stringify({
    topicId: input.topicId,
    acceptedLevel: input.acceptedLevel,
    correct: input.correct,
    progressState: input.progressState,
  });
  return { content: `<profile-data>${data}</profile-data>` };
}
