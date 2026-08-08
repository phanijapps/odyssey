import { expect, test } from "vitest";
import { authenticateChild } from "../../../server/identity/identity";
import { POST } from "./route";

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

  const accepted = await POST(
    await authenticatedRequest({ topicId: "ratio", answer: "2" }),
  );
  expect(accepted.status).toBe(200);
  await expect(accepted.json()).resolves.toMatchObject({
    correct: true,
    level: expect.any(Number),
    nextQuestion: { question: expect.any(String) },
  });
});
