import "server-only";

import { learningDb } from "./sqlite-repository";

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

  return {
    correctPracticeAttempts: attempts.length,
    activePracticeDayStreak,
    timezone: ACHIEVEMENT_TIMEZONE,
    badges: BADGES.map((badge) => ({
      ...badge,
      earned: attempts.length >= badge.threshold,
    })),
  };
}
