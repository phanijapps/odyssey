import { expect, test } from "vitest";
import { authenticateChild } from "../../../server/identity/identity";
import { POST } from "./route";

const ratioQuestions = [
  "A recipe uses 2 cups of flour for every 1 cup of sugar. What is the ratio of flour to sugar? (Use the format number:number)",
  "In a classroom, the ratio of boys to girls is 3:2. If there are 6 boys, how many girls are there?",
  "A smoothie uses 3 strawberries for every 1 banana. If you use 9 strawberries, how many bananas do you need?",
];

function expectedRatioQuestion(attemptCount: number): string {
  return ratioQuestions[attemptCount % ratioQuestions.length];
}

async function authenticatedRequest(body: unknown): Promise<Request> {
  const session = await authenticateChild({
    username: "demo",
    password: "demo",
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
    await authenticatedRequest({ topicId: "ratio", answer: "2:1", level: 13 }),
  );
  expect(rejected.status).toBe(400);

  const unknownTopic = await POST(
    await authenticatedRequest({ topicId: "not-a-topic", answer: "2" }),
  );
  expect(unknownTopic.status).toBe(400);

  const accepted = await POST(
    await authenticatedRequest({ topicId: "ratio", answer: "2:1" }),
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
    expectedRatioQuestion(firstPayload.attemptCount),
  );
  const secondAccepted = await POST(
    await authenticatedRequest({ topicId: "ratio", answer: "2:1" }),
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
    expectedRatioQuestion(secondPayload.attemptCount),
  );
  expect(secondPayload.nextQuestion.question).not.toBe(
    firstPayload.nextQuestion.question,
  );
});
