import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Agent } from "@earendil-works/pi-agent-core";
import {
  createModels,
  createProvider,
  type Model,
} from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { parseCurriculumRecord } from "../../../../packages/curriculum/src/curriculum-model";

const MAX_PI_INPUT_CHARACTERS = 60_000;

type PiStage = "bronze-to-silver" | "silver-to-gold";

type PiRequest = {
  readonly stage: PiStage;
  readonly promptPath: string;
  readonly systemPrompt: string;
  readonly data: string;
};

type PiCompletion = (request: PiRequest) => Promise<string>;

type SilverRecord = {
  readonly recordId: string;
  readonly title: string;
  readonly officialText: string;
  readonly source: { readonly page: number };
};

export type SilverCandidate = {
  readonly sourceSummary: string;
  readonly records: readonly SilverRecord[];
  readonly warnings: readonly string[];
  readonly provenance: { readonly promptVersion: "bronze-to-silver/v1" };
};

export type GoldCandidate = {
  readonly canonicalRecords: readonly ReturnType<
    typeof parseCurriculumRecord
  >[];
  readonly relations: readonly {
    readonly from: string;
    readonly to: string;
    readonly type: string;
  }[];
  readonly topics: readonly string[];
  readonly assessmentTargets: readonly string[];
  readonly provenance: { readonly promptVersion: "silver-to-gold/v1" };
};

/** Runs both curriculum transformation stages through one bounded Pi execution boundary. */
export class CurriculumPiAgent {
  constructor(private readonly complete: PiCompletion = completeWithPi) {}

  async run(input: {
    readonly stage: "bronze-to-silver";
    readonly input: unknown;
  }): Promise<SilverCandidate>;
  async run(input: {
    readonly stage: "silver-to-gold";
    readonly input: unknown;
  }): Promise<GoldCandidate>;
  async run(input: {
    readonly stage: PiStage;
    readonly input: unknown;
  }): Promise<SilverCandidate | GoldCandidate> {
    const serialized = JSON.stringify(input.input);
    if (!serialized || serialized.length > MAX_PI_INPUT_CHARACTERS)
      throw new Error("Curriculum Pi input exceeds limit");
    const profile = getProfile(input.stage);
    const response = await this.complete({
      stage: input.stage,
      promptPath: profile.path,
      systemPrompt: profile.systemPrompt,
      data: `<curriculum-data>${serialized}</curriculum-data>`,
    });
    const parsed = parsePiJson(response);
    return input.stage === "bronze-to-silver"
      ? validateSilverCandidate(parsed)
      : validateGoldCandidate(parsed);
  }
}

function getProfile(stage: PiStage): {
  readonly path: string;
  readonly systemPrompt: string;
} {
  const path = join(
    process.cwd(),
    "src/server/curriculum/prompts",
    stage === "bronze-to-silver"
      ? "bronze-to-silver.system.md"
      : "silver-to-gold.system.md",
  );
  return { path, systemPrompt: readFileSync(path, "utf8") };
}

async function completeWithPi(request: PiRequest): Promise<string> {
  const model = createLocalModel();
  const models = createModels();
  models.setProvider(
    createProvider({
      id: "curriculum-ollama",
      name: "Local Ollama",
      baseUrl: model.baseUrl,
      auth: { apiKey: { name: "Ollama", resolve: async () => ({ auth: {} }) } },
      models: [model],
      api: openAICompletionsApi(),
    }),
  );
  const agent = new Agent({
    initialState: {
      systemPrompt: request.systemPrompt,
      model,
      thinkingLevel: "off",
      tools: [],
    },
    streamFn: models.streamSimple.bind(models),
    shouldStopAfterTurn: () => true,
  });
  await agent.prompt(request.data);
  const message = agent.state.messages.findLast(
    (candidate) => candidate.role === "assistant",
  );
  if (!message || message.role !== "assistant")
    throw new Error("Curriculum Pi did not return a response");
  const content = message.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
  if (!content) throw new Error("Curriculum Pi did not return JSON");
  return content;
}

function createLocalModel(): Model<"openai-completions"> {
  const modelId = process.env.PI_MODEL;
  if (!modelId) throw new Error("Curriculum Pi model is not configured");
  const baseUrl = process.env.OLLAMA_OPENAI_URL ?? "http://127.0.0.1:11434/v1";
  return {
    id: modelId,
    name: modelId,
    api: "openai-completions",
    provider: "curriculum-ollama",
    baseUrl,
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 32_768,
    maxTokens: 2_048,
    compat: {
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
    },
  };
}

function parsePiJson(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    throw new Error("Invalid Pi JSON response");
  }
}

function validateSilverCandidate(input: unknown): SilverCandidate {
  if (!isObjectWithKeys(input, ["sourceSummary", "records", "warnings"]))
    throw new Error("Invalid Silver candidate");
  if (
    !isNonEmptyString(input.sourceSummary) ||
    !Array.isArray(input.records) ||
    !input.records.every(isSilverRecord) ||
    !isStringArray(input.warnings)
  )
    throw new Error("Invalid Silver candidate");
  return {
    sourceSummary: input.sourceSummary,
    records: input.records,
    warnings: input.warnings,
    provenance: { promptVersion: "bronze-to-silver/v1" },
  };
}

function validateGoldCandidate(input: unknown): GoldCandidate {
  if (
    !isObjectWithKeys(input, [
      "canonicalRecords",
      "relations",
      "topics",
      "assessmentTargets",
    ])
  )
    throw new Error("Invalid Gold candidate");
  if (
    !Array.isArray(input.canonicalRecords) ||
    !Array.isArray(input.relations) ||
    !input.relations.every(isRelation) ||
    !isStringArray(input.topics) ||
    !isStringArray(input.assessmentTargets)
  )
    throw new Error("Invalid Gold candidate");
  return {
    canonicalRecords: input.canonicalRecords.map(parseCurriculumRecord),
    relations: input.relations,
    topics: input.topics,
    assessmentTargets: input.assessmentTargets,
    provenance: { promptVersion: "silver-to-gold/v1" },
  };
}

function isSilverRecord(input: unknown): input is SilverRecord {
  return (
    isObjectWithKeys(input, ["recordId", "title", "officialText", "source"]) &&
    isNonEmptyString(input.recordId) &&
    isNonEmptyString(input.title) &&
    isNonEmptyString(input.officialText) &&
    isObjectWithKeys(input.source, ["page"]) &&
    Number.isInteger(input.source.page) &&
    Number(input.source.page) > 0
  );
}

function isRelation(
  input: unknown,
): input is {
  readonly from: string;
  readonly to: string;
  readonly type: string;
} {
  return (
    isObjectWithKeys(input, ["from", "to", "type"]) &&
    isNonEmptyString(input.from) &&
    isNonEmptyString(input.to) &&
    isNonEmptyString(input.type)
  );
}

function isObjectWithKeys(
  input: unknown,
  keys: readonly string[],
): input is Record<string, unknown> {
  return (
    !!input &&
    typeof input === "object" &&
    !Array.isArray(input) &&
    Object.keys(input).length === keys.length &&
    keys.every((key) => key in input)
  );
}

function isNonEmptyString(input: unknown): input is string {
  return typeof input === "string" && input.trim().length > 0;
}

function isStringArray(input: unknown): input is string[] {
  return (
    Array.isArray(input) && input.every((item) => typeof item === "string")
  );
}
