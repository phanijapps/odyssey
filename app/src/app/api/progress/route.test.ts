import { expect, test } from "vitest";
import {
  authenticateChild,
  requireLearnerRead,
} from "../../../server/identity/identity";
import {
  getLearningProgress,
  submitAnswer,
} from "../../../server/learning/learning";
import { withGoldDatabase } from "../../../server/curriculum/gold-database";
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
    nextQuestion: {
      question: string;
      diagramSvg: string;
      interaction: {
        type: string;
        prompt: string;
        response?: { maxLength: number };
      };
    };
  };
  expect(payload).toMatchObject(expected ?? {});
  expect(payload.nextQuestion).toBeTruthy();
  expect(typeof payload.nextQuestion.question).toBe("string");
  expect(typeof payload.nextQuestion.diagramSvg).toBe("string");
  expect(payload.nextQuestion.interaction).toEqual({
    type: "text-response",
    prompt: payload.nextQuestion.question,
    response: { maxLength: 100 },
  });
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

test("rejects a selected standard whose composite topic identity was tampered", async () => {
  const session = await authenticateChild({
    username: "test-learner",
    password: "test-learner-password",
  });
  const response = await GET(
    new Request(
      "http://localhost/api/progress?subject=Mathematics&grade=Grade%208&domain=Expressions&standard=8.EE.7&topicId=unreviewed-topic",
      { headers: { cookie: `session=${session.sessionToken}` } },
    ),
  );

  expect(response.status).toBe(400);
  expect(response.headers.get("cache-control")).toBe("no-store");
  await expect(response.json()).resolves.toEqual({
    error: "Invalid Practice selection",
  });
});

test("rejects a requested standard absent from the selected Gold domain", async () => {
  const session = await authenticateChild({
    username: "test-learner",
    password: "test-learner-password",
  });
  const response = await GET(
    new Request(
      "http://localhost/api/progress?subject=Mathematics&grade=Grade%208&domain=Expressions&standard=unreviewed&topicId=Mathematics%3A%3AGrade%208%3A%3AExpressions%3A%3Aunreviewed",
      { headers: { cookie: `session=${session.sessionToken}` } },
    ),
  );

  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toEqual({
    error: "Invalid Practice selection",
  });
});

test("accepts the exact topic identity for a reviewed selected standard", async () => {
  withGoldDatabase((database) => {
    database
      .prepare(
        `INSERT INTO gold_curriculum_records
          (record_id, subject, framework, content_json, source_fingerprint,
           prompt_version, model, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "progress-selection-fixture",
        "Mathematics",
        "fixture",
        JSON.stringify({
          id: "progress-selection-fixture",
          subject: "Mathematics",
          gradeOrCourse: "Grade 8",
          domain: "Selection fixture",
          standardCode: "8.F.1",
          standardText: "Understand slope and linear relationships.",
        }),
        "fixture",
        "v1",
        "fixture",
        "2026-01-01",
      );
  });
  const session = await authenticateChild({
    username: "test-learner",
    password: "test-learner-password",
  });
  const domainOnlyResponse = await GET(
    new Request(
      "http://localhost/api/progress?subject=Mathematics&grade=Grade%208&domain=Selection%20fixture&topicId=domain-selection-fixture",
      { headers: { cookie: `session=${session.sessionToken}` } },
    ),
  );
  expect(domainOnlyResponse.status).toBe(200);

  const topicId = "Mathematics::Grade 8::Selection fixture::8.F.1";
  const response = await GET(
    new Request(
      `http://localhost/api/progress?subject=Mathematics&grade=Grade%208&domain=Selection%20fixture&standard=8.F.1&topicId=${encodeURIComponent(topicId)}`,
      { headers: { cookie: `session=${session.sessionToken}` } },
    ),
  );

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    nextQuestion: { assignmentToken: expect.any(String) },
  });
});
