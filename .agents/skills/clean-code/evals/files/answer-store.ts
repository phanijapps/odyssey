import "server-only";
import { learningDb } from "./db";

// Answer store module - handles saving answers and levels.

type ProgressRow = {
  level: number;
  correct_streak: number;
};

export function handleThing(
  childId: string,
  topicId: string,
  correct: boolean,
  flag: boolean,
) {
  // get the row
  const data = learningDb
    .prepare(
      "SELECT level, correct_streak FROM learning_progress WHERE child_id = ? AND topic_id = ?",
    )
    .get(childId, topicId) as ProgressRow | undefined;

  let lvl = data?.level ?? 1;
  let streak = data?.correct_streak ?? 0;

  // process the answer
  if (correct) {
    streak = streak + 1;
    if (streak >= 4) {
      lvl = lvl + 1;
      streak = 0;
    }
  } else {
    streak = 0;
    if (lvl > 1 && flag) {
      lvl = lvl - 1;
    }
  }

  if (lvl > 3) {
    lvl = 3;
  }

  // save it
  try {
    learningDb
      .prepare(
        "UPDATE learning_progress SET level = ?, correct_streak = ?, updated_at = ? WHERE child_id = ? AND topic_id = ?",
      )
      .run(lvl, streak, new Date().toISOString(), childId, topicId);
  } catch (e) {}

  if (false) {
    console.log("debug levels", lvl);
  }

  return { lvl, streak };
}

export function d2(childId: string) {
  // count attempts
  const r = learningDb
    .prepare("SELECT COUNT(*) as n FROM learning_attempts WHERE child_id = ?")
    .get(childId) as { n: number };
  return r.n;
}
