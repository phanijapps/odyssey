import { completeWithLocalOllama } from "./providers/pi-completion";
import { getAtlasInstruction } from "./prompts/atlas-instruction";
import { isOllamaConfigured, validateGeneratedQuestionText } from "./agent";
import { ATLAS_PROMPT_VERSION } from "./prompts/atlas-instruction";
import { sanitizeGeneratedDiagramSvg } from "@odyssey/core";
import {
  textResponseInteraction,
  type LearnerQuestionInteraction,
} from "@odyssey/core";
import type { AtlasNode, SkillAtlas } from "@odyssey/core";

/**
 * Generates a complete skill atlas in ONE completion call.
 * Validates every node; prunes invalid nodes rather than discarding the set.
 * Returns null unless the surviving batch covers two concepts and all tiers.
 */
export async function generateSkillAtlas(input: {
  topicId: string;
  standardCode: string;
  standardText: string;
}): Promise<SkillAtlas | null> {
  if (!isOllamaConfigured()) return null;
  const content = await completeWithLocalOllama({
    systemPrompt: getAtlasInstruction(input.standardCode, input.standardText),
    messages: [`Generate the practice atlas for ${input.standardCode} now.`],
    timeoutMs: 90_000,
    maxTokens: 16_384,
  });

  if (content.length > 320_000) return null;
  let parsed: unknown;
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
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    Object.keys(parsed).length !== 1 ||
    !("nodes" in parsed) ||
    !Array.isArray(parsed.nodes) ||
    parsed.nodes.length < 4 ||
    parsed.nodes.length > 15
  )
    return null;

  const seen = new Set<string>();
  const nodes: AtlasNode[] = [];
  for (const raw of parsed.nodes) {
    const validated = validateAtlasNode(raw, seen, nodes.length);
    if (validated) {
      seen.add(validated.question);
      nodes.push(validated);
    }
  }

  if (
    nodes.length < 4 ||
    new Set(nodes.map((node) => node.concept)).size < 2 ||
    new Set(nodes.map((node) => node.tier)).size !== 3
  )
    return null;
  return { topicId: input.topicId, revision: ATLAS_PROMPT_VERSION, nodes };
}

/** Validates and normalizes one raw node; returns null if it fails any check. */
function validateAtlasNode(
  raw: unknown,
  seenQuestions: Set<string>,
  index: number,
): AtlasNode | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const fields = [
    "concept",
    "tier",
    "question",
    "answer",
    "acceptableAnswers",
    "hint",
    "solution",
    "diagramSvg",
  ];
  if (
    Object.keys(raw).length !== fields.length ||
    Object.keys(raw).some((key) => !fields.includes(key))
  )
    return null;
  const node = raw as Record<string, unknown>;
  if (
    !boundedText(node.concept, 3, 60) ||
    (node.tier !== 1 && node.tier !== 2 && node.tier !== 3) ||
    !boundedText(node.question, 20, 400) ||
    !boundedText(node.answer, 1, 100) ||
    !boundedText(node.hint, 10, 200) ||
    !Array.isArray(node.acceptableAnswers) ||
    node.acceptableAnswers.length > 5 ||
    !node.acceptableAnswers.every((answer): answer is string =>
      boundedText(answer, 1, 100),
    ) ||
    !Array.isArray(node.solution) ||
    node.solution.length < 2 ||
    node.solution.length > 5 ||
    !node.solution.every((step): step is string => boundedText(step, 1, 120)) ||
    typeof node.diagramSvg !== "string" ||
    node.diagramSvg.length > 20_000
  )
    return null;

  try {
    validateGeneratedQuestionText(node.question);
  } catch {
    return null;
  }
  if (seenQuestions.has(node.question)) return null;
  const safeDiagram = node.diagramSvg
    ? sanitizeGeneratedDiagramSvg(node.diagramSvg)
    : "";
  if (node.diagramSvg && !safeDiagram) return null;
  const interaction: LearnerQuestionInteraction = textResponseInteraction(
    node.question,
  );
  return {
    id: `atlas-${index + 1}`,
    concept: node.concept,
    tier: node.tier,
    question: node.question,
    interaction,
    answer: node.answer,
    acceptableAnswers: node.acceptableAnswers,
    hint: node.hint,
    solution: node.solution,
    diagramSvg: safeDiagram,
  };
}

/** Checks field bounds without changing the model's answer or question text. */
function boundedText(
  value: unknown,
  minimum: number,
  maximum: number,
): value is string {
  return (
    typeof value === "string" &&
    value.length >= minimum &&
    value.length <= maximum &&
    value.trim().length > 0
  );
}
