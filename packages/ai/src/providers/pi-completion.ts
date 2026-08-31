import {
  contentText,
  createModels,
  createProvider,
  type AssistantMessage,
  type Model,
} from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { getOllamaOpenAIUrl } from "./ollama-openai-url";

const LOCAL_OLLAMA_PROVIDER = "local-ollama";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_TOKENS = 2_048;
const MAX_TIMEOUT_MS = 120_000;
const MAX_MAX_TOKENS = 8_192;
const models = createModels();

/** Initialized once per process — provider registration is not cheap. */
let providerReady = false;
function ensureProvider(): void {
  if (providerReady) return;
  models.setProvider(
    createProvider({
      id: LOCAL_OLLAMA_PROVIDER,
      name: "Local Ollama",
      baseUrl: getOllamaOpenAIUrl(),
      auth: {
        apiKey: {
          name: "Local Ollama",
          resolve: async () => ({
            auth: { apiKey: process.env.PI_API_KEY || "ollama" },
            source: process.env.PI_API_KEY ? "PI_API_KEY" : "local Ollama",
          }),
        },
      },
      models: [buildModel()],
      api: openAICompletionsApi(),
    }),
  );
  providerReady = true;
}

function buildModel(): Model<"openai-completions"> {
  const baseUrl = getOllamaOpenAIUrl();
  const modelId = process.env.PI_MODEL;
  if (!modelId) throw new Error("Ollama model is not configured");
  return {
    id: modelId,
    name: modelId,
    provider: LOCAL_OLLAMA_PROVIDER,
    api: "openai-completions",
    baseUrl,
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 32_768,
    maxTokens: MAX_MAX_TOKENS,
    compat: {
      maxTokensField: "max_tokens",
      supportsStore: false,
      supportsUsageInStreaming: false,
    },
  };
}

export type LocalOllamaCompletionRequest = {
  readonly systemPrompt: string;
  readonly messages: readonly string[];
  readonly timeoutMs?: number;
  readonly maxTokens?: number;
};

/** Reports a failed or non-text completion without exposing provider internals. */
export class LocalOllamaCompletionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocalOllamaCompletionError";
  }
}

/**
 * Completes one stateless, text-only request through the local Ollama OpenAI
 * endpoint. This intentionally exposes neither tools nor agent state.
 */
export async function completeWithLocalOllama(
  request: LocalOllamaCompletionRequest,
): Promise<string> {
  const modelId = process.env.PI_MODEL;
  if (!modelId) throw new Error("Ollama model is not configured");

  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxTokens = request.maxTokens ?? DEFAULT_MAX_TOKENS;
  assertRequestBounds(timeoutMs, maxTokens);

  ensureProvider();
  const model = buildModel();

  const completion = await models.complete(
    model,
    {
      ...(request.systemPrompt ? { systemPrompt: request.systemPrompt } : {}),
      messages: request.messages.map((content) => ({
        role: "user" as const,
        content,
        timestamp: Date.now(),
      })),
    },
    {
      timeoutMs,
      maxTokens,
      maxRetries: 1,
      temperature: 0,
      cacheRetention: "short",
      samplingParams: { response_format: { type: "json_object" } },
    },
  );
  return extractLocalOllamaCompletionText(completion);
}

/** Extracts the final text only after Pi reports a successful completion. */
export function extractLocalOllamaCompletionText(
  completion: AssistantMessage,
): string {
  if (completion.stopReason !== "stop") {
    throw new LocalOllamaCompletionError(
      completion.errorMessage || "Local Ollama completion failed",
    );
  }
  const text = contentText(completion.content);
  if (!text)
    throw new LocalOllamaCompletionError("Local Ollama returned no text");
  return text;
}

function assertRequestBounds(timeoutMs: number, maxTokens: number): void {
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > MAX_TIMEOUT_MS ||
    !Number.isInteger(maxTokens) ||
    maxTokens < 1 ||
    maxTokens > MAX_MAX_TOKENS
  ) {
    throw new Error("Local Ollama request exceeds limit");
  }
}
