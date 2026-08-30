import "server-only";

import { getBrowseTree } from "../curriculum/browse";
import { getAchievements } from "./achievements";
import { getLearnerHistory } from "./learning";
import { getMistakeToMasteryPlan } from "./mistake-to-mastery";

const PERFORMANCE_ITEM_CAP = 5;

/** One actionable guidance card; topicId present only when Practice is available. */
export type PerformanceGuidanceCard = {
  readonly id: string;
  readonly standardCode: string;
  readonly statusText: string;
  readonly topicId?: string;
};

/** Plain, read-only performance payload rendered by the learner page. */
export type PerformanceReport = {
  readonly summary: {
    readonly tone: "neutral" | "positive";
    readonly text: string;
  };
  readonly practiceEvidence: {
    readonly tone: "neutral" | "positive";
    readonly text: string;
  };
  readonly practiceDetail: string;
  readonly testsDetail: string;
  readonly guidanceCards: readonly PerformanceGuidanceCard[];
  readonly guidanceFallback: string;
  readonly achievementsDetail: string;
  readonly funFactDetail: string;
  readonly separationNote: string;
};

function displayText(value: string, limit: number): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

const PRACTICE_EVIDENCE_ATTEMPT_THRESHOLD = 3;
/** Bounds a composed topic identity for safe URL navigation. */
const GUIDANCE_TOPIC_ID_MAX = 300;

function reviewedTopics(): Map<string, string> {
  const reviewedCodes = new Map<string, string>();
  for (const subject of getBrowseTree().subjects)
    for (const grade of subject.grades)
      for (const domain of grade.domains)
        for (const standard of domain.standards)
          reviewedCodes.set(
            `${subject.subject}::${grade.grade}::${domain.domain}::${standard.standardCode}`,
            displayText(standard.standardCode, 64),
          );
  return reviewedCodes;
}

function reviewedPracticeEvidence(
  topicIds: readonly string[],
  reviewedCodes: Map<string, string>,
): {
  codes: string[];
  attemptCount: number;
} {
  const matchingCodes = topicIds
    .map((topicId) => reviewedCodes.get(topicId))
    .filter((standardCode): standardCode is string => Boolean(standardCode));
  return {
    codes: [...new Set(matchingCodes)].slice(0, PERFORMANCE_ITEM_CAP),
    attemptCount: matchingCodes.length,
  };
}

function guidanceStatusText(
  state: "recommended" | "practicing" | "practice-checkpoint-met",
  actionable: boolean,
): string {
  const stateText =
    state === "practice-checkpoint-met"
      ? "Checkpoint met: three correct Practice answers since that Test."
      : state === "practicing"
        ? "You have answered this skill correctly since that Test. Keep practicing."
        : "Missed on your latest completed Test. Practice is recommended.";
  return actionable
    ? stateText
    : `${stateText} This skill is no longer in the reviewed curriculum, so Practice is unavailable.`;
}

/**
 * Produces a deterministic, read-only Performance report from redacted
 * learner history. It makes no mastery claim and intentionally excludes raw
 * answers, correctness, timestamps, and assignment identifiers; any guidance
 * is a separate deterministic snapshot-derived projection.
 */
export function getLearnerPerformanceReport(
  childId: string,
): PerformanceReport {
  const history = getLearnerHistory(childId);
  const practiceTopicIds = history
    .filter((entry) => entry.kind === "practice")
    .map((entry) => entry.topicId);
  const reviewedTopicIds = reviewedTopics();
  const practiceEvidence =
    practiceTopicIds.length === 0
      ? { codes: [], attemptCount: 0 }
      : reviewedPracticeEvidence(practiceTopicIds, reviewedTopicIds);
  const skills = practiceEvidence.codes;
  const guidance = getMistakeToMasteryPlan(childId).items;
  const guidanceCards: PerformanceGuidanceCard[] = guidance.map(
    (item, index) => {
      const actionable =
        reviewedTopicIds.has(item.topicId) &&
        item.topicId.length <= GUIDANCE_TOPIC_ID_MAX;
      return {
        id: `guidance-${index + 1}`,
        standardCode: displayText(item.standardCode, 64),
        statusText: displayText(
          guidanceStatusText(item.state, actionable),
          160,
        ),
        ...(actionable ? { topicId: item.topicId } : {}),
      };
    },
  );
  const achievements = getAchievements(childId);
  const tests = history
    .filter((entry) => entry.kind === "test")
    .slice(0, PERFORMANCE_ITEM_CAP)
    .map((entry) => ({
      subject: displayText(entry.subject, 64),
      grade: displayText(entry.grade, 64),
      status: entry.status,
    }));

  return {
    summary: {
      tone: history.length === 0 ? "neutral" : "positive",
      text:
        history.length === 0
          ? "No activity is recorded yet. Practice or complete a Test to see a factual summary here."
          : "This summary keeps Practice activity and Test events separate.",
    },
    practiceEvidence: {
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
    practiceDetail: displayText(
      skills.length === 0
        ? "No Practice activity is recorded yet."
        : `Recent Practice skills: ${skills.join(", ")}.`,
      320,
    ),
    testsDetail: displayText(
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
    guidanceCards,
    guidanceFallback: displayText(
      "No Test-based Practice recommendations are available yet.",
      320,
    ),
    achievementsDetail: `${achievements.correctPracticeAttempts} correct Practice answers · ${achievements.activePracticeDayStreak}-day active Practice streak.`,
    funFactDetail: displayText(
      `${achievements.funFact.fact} Source: ${achievements.funFact.source.title}, ${achievements.funFact.source.locator}.`,
      320,
    ),
    separationNote: "Tests do not change Practice progress or mastery.",
  };
}
