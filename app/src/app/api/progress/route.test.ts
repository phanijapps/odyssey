import { expect, test } from "vitest";
import { authenticateChild } from "../../../server/identity/identity";
import {
  getLearningProgress,
  submitAnswer,
} from "../../../server/learning/learning";
import { GET } from "./route";

test("returns only the signed-in child's persisted topic progress", async () => {
  const session = await authenticateChild({
    username: "demo",
    password: "demo",
  });
  await submitAnswer({
    childId: session.childId,
    topicId: "linear",
    answer: "2",
    expectedAnswer: "2",
    nextLevel: 1,
  });
  const expected = getLearningProgress(session.childId, "linear");
  await submitAnswer({
    childId: "other-child",
    topicId: "linear",
    answer: "3",
    expectedAnswer: "2",
    nextLevel: 1,
  });
  expect(getLearningProgress("other-child", "linear")).not.toEqual(expected);

  const response = await GET(
    new Request("http://localhost/api/progress?topicId=linear", {
      headers: { cookie: `session=${session.sessionToken}` },
    }),
  );
  expect(response.status).toBe(200);
  const payload = (await response.json()) as {
    level: number;
    correctStreak: number;
    attemptCount: number;
    nextQuestion: { question: string; diagramSvg: string };
  };
  expect(payload).toMatchObject(expected ?? {});
  expect(payload.nextQuestion).toBeTruthy();
  expect(typeof payload.nextQuestion.question).toBe("string");
  expect(typeof payload.nextQuestion.diagramSvg).toBe("string");
});

test("rejects anonymous progress reads", async () => {
  expect(
    (await GET(new Request("http://localhost/api/progress?topicId=ratio")))
      .status,
  ).toBe(401);
});
