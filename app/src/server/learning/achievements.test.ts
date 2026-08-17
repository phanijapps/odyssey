import { expect, test } from "vitest";
import { getAchievements } from "./achievements";
import { isReviewedFunFact, reviewedFunFacts } from "./fun-facts";
import { learningDb } from "./sqlite-repository";

function recordAttempt(input: {
  learnerId: string;
  correct: number;
  createdAt: string;
}): void {
  learningDb
    .prepare(
      `INSERT INTO learning_attempts
        (child_id, topic_id, correct, level_before, level_after, created_at)
       VALUES (?, 'Mathematics::Grade 8::Expressions::8.EE.7', ?, 1, 2, ?)`,
    )
    .run(input.learnerId, input.correct, input.createdAt);
}

test("counts only accepted correct Practice attempts and derives badges", () => {
  for (let index = 0; index < 100; index += 1)
    recordAttempt({
      learnerId: "achievement-learner",
      correct: 1,
      createdAt: "2026-01-02T17:00:00.000Z",
    });
  recordAttempt({
    learnerId: "achievement-learner",
    correct: 0,
    createdAt: "2026-01-02T17:00:00.000Z",
  });

  expect(
    getAchievements(
      "achievement-learner",
      new Date("2026-01-02T18:00:00.000Z"),
    ),
  ).toEqual({
    correctPracticeAttempts: 100,
    activePracticeDayStreak: 1,
    timezone: "America/New_York",
    badges: [
      { id: "practice-100", threshold: 100, earned: true },
      { id: "practice-1000", threshold: 1000, earned: false },
    ],
    funFact: {
      id: "triangle-angle-sum",
      fact: "In plane geometry, a triangle's three interior angles add up to 180 degrees.",
      source: {
        title: "The Thirteen Books of Euclid's Elements",
        edition: "Thomas L. Heath translation, 1908",
        locator: "Book I, Proposition 32",
        canonicalUrl: "https://www.gutenberg.org/ebooks/21076",
        rightsBasis: "public-domain-edition",
      },
    },
  });
});

test("ends a streak when the current Eastern Time day has no correct Practice", () => {
  recordAttempt({
    learnerId: "achievement-streak",
    correct: 1,
    createdAt: "2026-01-01T18:00:00.000Z",
  });
  recordAttempt({
    learnerId: "achievement-streak",
    correct: 1,
    createdAt: "2026-01-02T18:00:00.000Z",
  });

  expect(
    getAchievements("achievement-streak", new Date("2026-01-03T18:00:00.000Z")),
  ).toMatchObject({ activePracticeDayStreak: 0 });
  expect(
    getAchievements("achievement-streak", new Date("2026-01-02T18:00:00.000Z")),
  ).toMatchObject({ activePracticeDayStreak: 2 });
});

test("uses only bounded approved local facts and rotates from correct Practice", () => {
  expect(reviewedFunFacts).toHaveLength(2);
  expect(reviewedFunFacts.every(isReviewedFunFact)).toBe(true);
  recordAttempt({
    learnerId: "achievement-facts",
    correct: 1,
    createdAt: "2026-01-01T18:00:00.000Z",
  });
  expect(
    getAchievements("achievement-facts", new Date("2026-01-01T18:00:00.000Z"))
      .funFact.id,
  ).toBe("infinite-primes");
  recordAttempt({
    learnerId: "achievement-facts",
    correct: 0,
    createdAt: "2026-01-01T18:01:00.000Z",
  });
  expect(
    getAchievements("achievement-facts", new Date("2026-01-01T18:01:00.000Z"))
      .funFact.id,
  ).toBe("infinite-primes");
});
