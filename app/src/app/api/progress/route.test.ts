import { expect, test } from "vitest";
import { authenticateChild } from "../../../server/identity/identity";
import {
  getLearningProgress,
  submitAnswer,
} from "../../../server/learning/learning";
import { GET } from "./route";

test("returns only the signed-in child's persisted topic progress", async () => {
  const session = await authenticateChild({
    username: "child",
    password: "development-password",
  });
  await submitAnswer({
    childId: session.childId,
    topicId: "linear",
    answer: "2",
    nextLevel: 1,
  });
  const expected = getLearningProgress(session.childId, "linear");
  await submitAnswer({
    childId: "other-child",
    topicId: "linear",
    answer: "3",
    nextLevel: 1,
  });
  expect(getLearningProgress("other-child", "linear")).not.toEqual(expected);

  const response = GET(
    new Request("http://localhost/api/progress?topicId=linear", {
      headers: { cookie: `session=${session.sessionToken}` },
    }),
  );
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual(expected);
});

test("rejects anonymous and unreviewed progress reads", async () => {
  expect(
    GET(new Request("http://localhost/api/progress?topicId=ratio")).status,
  ).toBe(401);

  const session = await authenticateChild({
    username: "child",
    password: "development-password",
  });
  expect(
    GET(
      new Request("http://localhost/api/progress?topicId=unreviewed", {
        headers: { cookie: `session=${session.sessionToken}` },
      }),
    ).status,
  ).toBe(400);
});
