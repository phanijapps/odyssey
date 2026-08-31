import { completeWithLocalOllama } from "./providers/pi-completion";
import { getAtlasInstruction } from "./prompts/atlas-instruction";
import { validateGeneratedQuestionText } from "./agent";
import { sanitizeGeneratedDiagramSvg } from "@odyssey/core";
import {
  textResponseInteraction,
  type LearnerQuestionInteraction,
} from "@odyssey/core";
import type { AtlasNode, SkillAtlas } from "@odyssey/core";

/** Raw node as the model returns it (pre-validation, pre-id assignment). */
type RawAtlasNode = {
  concept: string;
  tier: number;
  question: string;
  answer: string;
  acceptableAnswers: string[];
  hint: string;
  solution: string[];
  diagramSvg: string;
};

/**
 * Generates a complete skill atlas in ONE completion call.
 * Validates every node; prunes invalid nodes rather than discarding the set.
 * Returns null if fewer than 4 nodes survive validation.
 */
export async function generateSkillAtlas(input: {
  topicId: string;
  standardCode: string;
  standardText: string;
}): Promise<SkillAtlas | null> {
  const content = await completeWithLocalOllama({
    systemPrompt: getAtlasInstruction(input.standardCode, input.standardText),
    messages: [`Generate the practice atlas for ${input.standardCode} now.`],
    timeoutMs: 90_000,
    maxTokens: 8_192,
  });

  let parsed: { nodes?: RawAtlasNode[] };
  try {
    parsed = JSON.parse(
      content
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, ""),
    );
  } catch {
    return null;
  }
  if (!Array.isArray(parsed.nodes) || parsed.nodes.length < 4) return null;

  const seen = new Set<string>();
  const nodes: AtlasNode[] = [];
  for (const raw of parsed.nodes) {
    const validated = validateAtlasNode(raw, seen);
    if (validated) {
      seen.add(validated.question);
      nodes.push(validated);
    }
  }

  if (nodes.length < 4) return null;
  return { topicId: input.topicId, revision: "atlas-v1", nodes };
}

/** Validates and normalizes one raw node; returns null if it fails any check. */
function validateAtlasNode(
  raw: RawAtlasNode,
  seenQuestions: Set<string>,
): AtlasNode | null {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.concept !== "string" || raw.concept.length < 3) return null;
  if (![1, 2, 3].includes(raw.tier)) return null;
  if (typeof raw.question !== "string") return null;
  if (typeof raw.answer !== "string" || !raw.answer.trim()) return null;

  try {
    validateGeneratedQuestionText(raw.question);
  } catch {
    return null;
  }
  if (seenQuestions.has(raw.question)) return null;

  const solution = Array.isArray(raw.solution)
    ? raw.solution
        .filter((s: unknown): s is string => typeof s === "string")
        .map((s: string) => s.slice(0, 200))
    : [];
  if (solution.length < 1 || solution.length > 5) return null;

  const acceptableAnswers = Array.isArray(raw.acceptableAnswers)
    ? raw.acceptableAnswers.filter(
        (a: unknown): a is string => typeof a === "string",
      )
    : [];

  const safeDiagram =
    typeof raw.diagramSvg === "string" && raw.diagramSvg.length > 10
      ? sanitizeGeneratedDiagramSvg(raw.diagramSvg)
      : "";

  const interaction: LearnerQuestionInteraction = textResponseInteraction(
    raw.question,
  );

  return {
    id: `atlas-${raw.concept.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${raw.tier}-${nodes_safeId()}`,
    concept: raw.concept.slice(0, 60),
    tier: raw.tier as 1 | 2 | 3,
    question: raw.question,
    interaction,
    answer: raw.answer.slice(0, 120),
    acceptableAnswers,
    hint:
      typeof raw.hint === "string" && raw.hint.length >= 10
        ? raw.hint.slice(0, 200)
        : "Think about what the question is really asking.",
    solution,
    diagramSvg: safeDiagram,
  };
}

let idCounter = 0;
function nodes_safeId(): string {
  idCounter += 1;
  return `${Date.now().toString(36)}-${idCounter}`;
}
