import "server-only";

import { reviewedSampleForStandard } from "@odyssey/core";
import { getMistakeToMasteryPlan } from "./mistake-to-mastery";

type LinkedChild = {
  readonly scopeKey: string;
  readonly username: string;
};

export type ParentPracticePreview = {
  readonly childUsername: string;
  readonly standardCode: string;
  readonly standardText: string;
  readonly question: string;
  readonly diagramSvg: string | null;
} | null;

function displayText(value: string, limit: number): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

/**
 * Derives one non-mutating parent preview: the first active linked child's
 * next recommended Practice target with a genuinely matching reviewed sample
 * question. It reads only derived plan state, writes nothing, and returns no
 * answer, hint, solution, or token material.
 */
export function getParentPracticePreview(
  children: readonly LinkedChild[],
): ParentPracticePreview {
  for (const child of children) {
    const items = getMistakeToMasteryPlan(child.scopeKey).items;
    const target = items.find(
      (item) => item.state === "recommended" || item.state === "practicing",
    );
    if (!target) continue;
    const sample = reviewedSampleForStandard(target.standardText);
    if (!sample) continue;
    return {
      childUsername: displayText(child.username, 64),
      standardCode: displayText(target.standardCode, 64),
      standardText: displayText(target.standardText, 320),
      question: displayText(sample.question, 320),
      diagramSvg:
        sample.diagramSvg && sample.diagramSvg.length <= 4000
          ? sample.diagramSvg
          : null,
    };
  }
  return null;
}
