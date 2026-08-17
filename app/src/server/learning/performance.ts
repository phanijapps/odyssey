import "server-only";

import {
  parseOdysseyA2uiDocument,
  type OdysseyA2uiDocument,
} from "../../a2ui/document";
import { getBrowseTree } from "../curriculum/browse";
import { getAchievements } from "./achievements";
import { getLearnerHistory } from "./learning";
import { getMistakeToMasteryPlan } from "./mistake-to-mastery";

const PERFORMANCE_ITEM_CAP = 5;
type PerformanceComponents =
  OdysseyA2uiDocument["messages"][1]["updateComponents"]["components"];

function displayText(value: string, limit: number): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

const PRACTICE_EVIDENCE_ATTEMPT_THRESHOLD = 3;

function reviewedPracticeEvidence(topicIds: readonly string[]): {
  codes: string[];
  attemptCount: number;
} {
  const reviewedCodes = new Map<string, string>();
  for (const subject of getBrowseTree().subjects)
    for (const grade of subject.grades)
      for (const domain of grade.domains)
        for (const standard of domain.standards)
          reviewedCodes.set(
            `${subject.subject}::${grade.grade}::${domain.domain}::${standard.standardCode}`,
            displayText(standard.standardCode, 64),
          );

  const matchingCodes = topicIds
    .map((topicId) => reviewedCodes.get(topicId))
    .filter((standardCode): standardCode is string => Boolean(standardCode));
  return {
    codes: [...new Set(matchingCodes)].slice(0, PERFORMANCE_ITEM_CAP),
    attemptCount: matchingCodes.length,
  };
}

/**
 * Produces a deterministic, read-only Performance surface from redacted
 * learner history. It makes no mastery claim and intentionally excludes raw
 * answers, correctness, timestamps, and assignment identifiers; any guidance
 * is a separate deterministic snapshot-derived projection.
 */
export function getLearnerPerformanceDocument(
  childId: string,
): OdysseyA2uiDocument {
  const history = getLearnerHistory(childId);
  const practiceTopicIds = history
    .filter((entry) => entry.kind === "practice")
    .map((entry) => entry.topicId);
  const practiceEvidence =
    practiceTopicIds.length === 0
      ? { codes: [], attemptCount: 0 }
      : reviewedPracticeEvidence(practiceTopicIds);
  const skills = practiceEvidence.codes;
  const guidance = getMistakeToMasteryPlan(childId).items;
  const achievements = getAchievements(childId);
  const tests = history
    .filter((entry) => entry.kind === "test")
    .slice(0, PERFORMANCE_ITEM_CAP)
    .map((entry) => ({
      subject: displayText(entry.subject, 64),
      grade: displayText(entry.grade, 64),
      status: entry.status,
    }));

  const components: PerformanceComponents = [
    {
      component: "OdysseyColumn",
      id: "root",
      children: [
        "title",
        "summary",
        "practice-title",
        "practice-evidence",
        "practice-detail",
        "tests-title",
        "tests-detail",
        "guidance-title",
        "guidance-detail",
        "achievements-title",
        "achievements-detail",
        "fun-fact-title",
        "fun-fact-detail",
        "separation-note",
      ],
    },
    {
      component: "OdysseyText",
      id: "title",
      variant: "h1",
      text: "Performance",
    },
    {
      component: "OdysseyStatus",
      id: "summary",
      tone: history.length === 0 ? "neutral" : "positive",
      text:
        history.length === 0
          ? "No activity is recorded yet. Practice or complete a Test to see a factual summary here."
          : "This summary keeps Practice activity and Test events separate.",
    },
    {
      component: "OdysseyText",
      id: "practice-title",
      variant: "h2",
      text: "Practice",
    },
    {
      component: "OdysseyStatus",
      id: "practice-evidence",
      tone:
        practiceEvidence.attemptCount >= PRACTICE_EVIDENCE_ATTEMPT_THRESHOLD
          ? "positive"
          : "neutral",
      text:
        practiceEvidence.attemptCount === 0
          ? "No reviewed Practice evidence is available yet."
          : practiceEvidence.attemptCount < PRACTICE_EVIDENCE_ATTEMPT_THRESHOLD
            ? "More reviewed Practice activity will make a fuller recent summary available."
            : `Recent reviewed Practice evidence is available for ${skills.length} skill${skills.length === 1 ? "" : "s"}.`,
    },
    {
      component: "OdysseyText",
      id: "practice-detail",
      variant: "body",
      text: displayText(
        skills.length === 0
          ? "No Practice activity is recorded yet."
          : `Recent Practice skills: ${skills.join(", ")}.`,
        320,
      ),
    },
    {
      component: "OdysseyText",
      id: "tests-title",
      variant: "h2",
      text: "Tests",
    },
    {
      component: "OdysseyText",
      id: "tests-detail",
      variant: "body",
      text: displayText(
        tests.length === 0
          ? "No completed or partial Tests are recorded yet."
          : tests
              .map(
                (entry) =>
                  `${entry.subject} · ${entry.grade} · ${entry.status === "completed" ? "completed" : "partial"}`,
              )
              .join("; "),
        320,
      ),
    },
    {
      component: "OdysseyText",
      id: "guidance-title",
      variant: "h2",
      text: "Next Practice",
    },
    {
      component: "OdysseyText",
      id: "guidance-detail",
      variant: "body",
      text: displayText(
        guidance.length === 0
          ? "No Test-based Practice recommendations are available yet."
          : guidance
              .map((item) => {
                if (item.state === "practice-checkpoint-met")
                  return `${item.standardCode}: Practice checkpoint met`;
                if (item.state === "practicing")
                  return `${item.standardCode}: Keep practicing`;
                return `${item.standardCode}: Recommended Practice`;
              })
              .join("; "),
        320,
      ),
    },
    {
      component: "OdysseyText",
      id: "achievements-title",
      variant: "h2",
      text: "Practice achievements",
    },
    {
      component: "OdysseyText",
      id: "achievements-detail",
      variant: "body",
      text: `${achievements.correctPracticeAttempts} correct Practice answers · ${achievements.activePracticeDayStreak}-day active Practice streak.`,
    },
    {
      component: "OdysseyText",
      id: "fun-fact-title",
      variant: "h2",
      text: "Math fun fact",
    },
    {
      component: "OdysseyText",
      id: "fun-fact-detail",
      variant: "body",
      text: displayText(
        `${achievements.funFact.fact} Source: ${achievements.funFact.source.title}, ${achievements.funFact.source.locator}.`,
        320,
      ),
    },
    {
      component: "OdysseyText",
      id: "separation-note",
      variant: "caption",
      text: "Tests do not change Practice progress or mastery.",
    },
  ];

  return parseOdysseyA2uiDocument({
    messages: [
      {
        version: "v0.9",
        createSurface: {
          surfaceId: "odyssey-performance",
          catalogId: "odyssey.learning.v1",
        },
      },
      {
        version: "v0.9",
        updateComponents: {
          surfaceId: "odyssey-performance",
          components,
        },
      },
    ],
  });
}
