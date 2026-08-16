import { expect, test } from "vitest";
import {
  authenticateChild,
  requireLearnerRead,
} from "../../../server/identity/identity";
import {
  getLearningProgress,
  submitAnswer,
} from "../../../server/learning/learning";
import { GET } from "./route";

test("returns only the signed-in child's persisted topic progress", async () => {
  const session = await authenticateChild({
    username: "test-learner",
    password: "test-learner-password",
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
    new Request(
      "http://localhost/api/progress?topicId=linear&childId=other-child",
      {
        headers: { cookie: `session=${session.sessionToken}` },
      },
    ),
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

test("treats a legacy test query as practice", async () => {
  const session = await authenticateChild({
    username: "test-learner",
    password: "test-learner-password",
  });
  const response = await GET(
    new Request("http://localhost/api/progress?topicId=ratio&mode=test", {
      headers: { cookie: `session=${session.sessionToken}` },
    }),
  );

  expect(response.status).toBe(200);
  const payload = (await response.json()) as {
    poolProgress: { total: number };
  };
  expect(payload.poolProgress.total).toBe(6);
});

test("rejects anonymous progress reads", async () => {
  expect(
    (await GET(new Request("http://localhost/api/progress?topicId=ratio")))
      .status,
  ).toBe(401);
});

test("rejects an admin from child-scoped practice progress", async () => {
  const admin = await authenticateChild({
    username: "test-admin",
    password: "test-admin-password",
  });
  expect(admin.role).toBe("admin");
  const request = new Request("http://localhost/api/progress?topicId=linear", {
    headers: { cookie: `session=${admin.sessionToken}` },
  });
  expect(() => requireLearnerRead(request)).toThrow("Learner access required");
  expect(() => requireLearnerRead(request)).toThrow("Learner access required");
  const response = await GET(request);

  expect(response.status).toBe(401);
  await expect(response.json()).resolves.toEqual({
    error: "Learner access required",
  });
});

test("concurrent progress reads return the same active assignment", async () => {
  const session = await authenticateChild({
    username: "test-learner",
    password: "test-learner-password",
  });
  const request = () =>
    new Request(
      "http://localhost/api/progress?topicId=concurrent-claim-ratio",
      {
        headers: { cookie: `session=${session.sessionToken}` },
      },
    );
  const [first, second] = await Promise.all([GET(request()), GET(request())]);
  expect([first.status, second.status]).toEqual([200, 200]);
  const [a, b] = (await Promise.all([first.json(), second.json()])) as Array<{
    nextQuestion: { assignmentToken: string; question: string };
    poolProgress: { position: number };
  }>;
  expect(a.nextQuestion.assignmentToken).toBe(b.nextQuestion.assignmentToken);
  expect(a.nextQuestion.question).toBe(b.nextQuestion.question);
  expect(a.poolProgress.position).toBe(1);
  expect(b.poolProgress.position).toBe(1);
});
