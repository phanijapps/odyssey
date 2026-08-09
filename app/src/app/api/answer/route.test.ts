import { expect, test } from "vitest";
import { authenticateChild } from "../../../server/identity/identity";
import { POST } from "./route";

function expectedRatioQuestion(attemptCount: number, level: number): string {
  return [
    `A recipe uses 1 cup of water for every 2 cups of flour. How many cups of flour are needed at level ${level}?`,
    `A smoothie recipe uses 1 cup of water for every 3 cups of flour. How many cups of flour are needed at level ${level}?`,
    `A soup recipe uses 2 cups of water for every 4 cups of flour. How many cups of flour go with 2 cups of water at level ${level}?`,
  ][attemptCount % 3];
}

async function authenticatedRequest(body: unknown): Promise<Request> {
  const session = await authenticateChild({
    username: "child",
    password: "development-password",
  });
  return new Request("http://localhost/api/answer", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `session=${session.sessionToken}`,
      origin: "http://localhost",
    },
    body: JSON.stringify(body),
  });
}

test("accepts only the allowlisted answer-submission shape", async () => {
  const rejected = await POST(
    await authenticatedRequest({ topicId: "ratio", answer: "2", level: 13 }),
  );
  expect(rejected.status).toBe(400);

  const unknownTopic = await POST(
    await authenticatedRequest({ topicId: "unreviewed", answer: "2" }),
  );
  expect(unknownTopic.status).toBe(400);

  const accepted = await POST(
    await authenticatedRequest({ topicId: "ratio", answer: "2" }),
  );
  expect(accepted.status).toBe(200);
  const firstPayload = (await accepted.json()) as {
    correct: boolean;
    level: number;
    attemptCount: number;
    nextQuestion: { question: string };
  };
  expect(firstPayload).toMatchObject({
    correct: true,
    attemptCount: expect.any(Number),
    nextQuestion: { question: expect.any(String) },
  });
  expect(firstPayload.nextQuestion.question).toBe(
    expectedRatioQuestion(firstPayload.attemptCount, firstPayload.level),
  );
  const secondAccepted = await POST(
    await authenticatedRequest({ topicId: "ratio", answer: "2" }),
  );
  expect(secondAccepted.status).toBe(200);
  const secondPayload = (await secondAccepted.json()) as {
    correct: boolean;
    level: number;
    correctStreak: number;
    attemptCount: number;
    nextQuestion: { question: string };
  };
  expect(secondPayload.attemptCount).toBe(firstPayload.attemptCount + 1);
  expect(secondPayload.correct).toBe(false);
  expect(secondPayload.correctStreak).toBe(0);
  expect(secondPayload.level).toBe(firstPayload.level);
  expect(secondPayload.nextQuestion.question).toBe(
    expectedRatioQuestion(secondPayload.attemptCount, secondPayload.level),
  );
  expect(secondPayload.nextQuestion.question).not.toBe(
    firstPayload.nextQuestion.question,
  );
});
