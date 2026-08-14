import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCurriculumRecord } from "../../../../packages/curriculum/src/curriculum-model";

const MAX_PI_INPUT_CHARACTERS = 120_000;

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
  const modelId = process.env.PI_MODEL;
  if (!modelId) throw new Error("Curriculum Pi model is not configured");
  const baseUrl = process.env.OLLAMA_OPENAI_URL ?? "http://127.0.0.1:11434/v1";
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      model: modelId,
      stream: false,
      max_tokens: 8_192,
      response_format: { type: "json_object" },
      temperature: 0,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.data },
      ],
    }),
  });
  if (!response.ok) throw new Error("Curriculum Pi request failed");
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const choices = payload.choices;
  if (!Array.isArray(choices) || choices.length === 0)
    throw new Error("Curriculum Pi did not return a response");
  const messageContent = choices[0]?.message?.content;
  if (typeof messageContent !== "string" || !messageContent)
    throw new Error("Curriculum Pi did not return JSON");
  return messageContent;
}

function parsePiJson(input: string): unknown {
  const trimmed = input.trim();
  let candidate = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "");
  try {
    return JSON.parse(candidate);
  } catch {
    // Try extracting the outermost JSON object
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      candidate = candidate.slice(start, end + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        // JSON is likely truncated — skip this chunk gracefully
      }
    }
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

function isRelation(input: unknown): input is {
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
