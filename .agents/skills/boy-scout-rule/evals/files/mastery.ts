import "server-only";
import { readFileSync } from "node:fs";
import { learningDb } from "./db";

export type Attempt = {
  correct: boolean;
  createdAt: string;
};

// Mastery promotes one level after a streak of 4 correct answers in a row.
// Wrong answers reset the streak but never demote.
export function computeMasteryLevel(history: Attempt[]): number {
  if (history.length === 0) {
    return 1;
  } else {
    const streak = currentStreak(history);
    const level = baseLevel(history);
    if (streak > 4) {
      return Math.min(level + 1, 3);
    }
    return level;
  }
}

export function currentStreak(history: Attempt[]): number {
  let n = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].correct) {
      n = n + 1;
    } else {
      break;
    }
  }
  return n;
}

function baseLevel(history: Attempt[]): number {
  const row = learningDb
    .prepare("SELECT level FROM learning_progress LIMIT 1")
    .get() as { level: number } | undefined;
  return row?.level ?? 1;
}

// kept for the old export consumers
export function oldComputeMasteryLevel(history: Attempt[]): number {
  return computeMasteryLevel(history);
}
