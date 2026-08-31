import "server-only";

import { selectReviewedFunFact, type ReviewedFunFact } from "./fun-facts";
import { learningDb } from "@odyssey/db";

const ACHIEVEMENT_TIMEZONE = "America/New_York";
const BADGES = [
  { id: "practice-100", threshold: 100 },
  { id: "practice-1000", threshold: 1000 },
] as const;

export type AchievementProjection = {
  readonly correctPracticeAttempts: number;
  readonly activePracticeDayStreak: number;
  readonly timezone: typeof ACHIEVEMENT_TIMEZONE;
  readonly badges: readonly {
    readonly id: (typeof BADGES)[number]["id"];
    readonly threshold: (typeof BADGES)[number]["threshold"];
    readonly earned: boolean;
  }[];
  readonly funFact: Pick<ReviewedFunFact, "id" | "fact" | "source">;
};

const easternDayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: ACHIEVEMENT_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function easternDay(value: string | Date): string | null {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  const parts = easternDayFormatter.formatToParts(date);
  const field = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value;
  const year = field("year");
  const month = field("month");
  const day = field("day");
  return year && month && day ? `${year}-${month}-${day}` : null;
}

function previousDay(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

// Both day anchors are ET calendar-day strings parsed at UTC midnight; the
// subtraction is timezone-offset-agnostic because both anchors shift by the
// same amount. Day arithmetic, not instant arithmetic.
function midnightsBetween(fromDay: string, toDay: string): number {
  const from = Date.parse(`${fromDay}T00:00:00.000Z`);
  const to = Date.parse(`${toDay}T00:00:00.000Z`);
  return Math.round((to - from) / 86_400_000);
}

/**
 * Day-granularity recency for parent surfaces (RFC-0005): the number of
 * America/New_York midnights between `now` and the most recent ET calendar
 * day with a correct attempt. Null when the learner has no correct
 * attempts. Never exposes time-of-day. The ET day boundary crosses at
 * 04:00/05:00 UTC (ET midnight). Shares `easternDay` with the streak loop
 * in `getAchievements` — changes to either must preserve their consistency.
 */
export function daysSinceLastCorrectPractice(
  learnerId: string,
  now = new Date(),
): number | null {
  const row = learningDb
    .prepare(
      `SELECT MAX(created_at) AS last FROM learning_attempts
       WHERE child_id = ? AND correct = 1`,
    )
    .get(learnerId) as { last: string | null };
  const lastDay = row.last === null ? null : easternDay(row.last);
  const today = easternDay(now);
  if (!lastDay || !today) return null;
  return midnightsBetween(lastDay, today);
}

/**
 * Recomputes learner-only Practice achievements from accepted learning records.
 * Tests, parent views, and rejected/replayed submissions have no write path to
 * this projection and are therefore excluded by construction.
 */
export function getAchievements(
  learnerId: string,
  now = new Date(),
): AchievementProjection {
  const attempts = learningDb
    .prepare(
      `SELECT created_at FROM learning_attempts
       WHERE child_id = ? AND correct = 1
       ORDER BY created_at DESC`,
    )
    .all(learnerId) as Array<{ created_at: string }>;
  const days = new Set(
    attempts
      .map((attempt) => easternDay(attempt.created_at))
      .filter((day): day is string => day !== null),
  );
  let activePracticeDayStreak = 0;
  let day = easternDay(now);
  while (day && days.has(day)) {
    activePracticeDayStreak += 1;
    day = previousDay(day);
  }

  const funFact = selectReviewedFunFact(attempts.length);
  return {
    correctPracticeAttempts: attempts.length,
    activePracticeDayStreak,
    timezone: ACHIEVEMENT_TIMEZONE,
    badges: BADGES.map((badge) => ({
      ...badge,
      earned: attempts.length >= badge.threshold,
    })),
    funFact: { id: funFact.id, fact: funFact.fact, source: funFact.source },
  };
}
