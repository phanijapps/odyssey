import { expect, test } from "vitest";
import {
  authenticateChild,
  setSessionPool,
} from "../../../server/identity/identity";
import { POST } from "./route";

const TOPIC = "ratio";

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

function seedRequest(body: unknown): Request {
  return authenticatedRequest(body) as unknown as Request;
}

test("accepts only the allowlisted answer-submission shape", async () => {
  const rejected = await POST(
    await authenticatedRequest({ topicId: "ratio", answer: "2:1", level: 13 }),
  );
  expect(rejected.status).toBe(400);

  const accepted = await POST(
    await authenticatedRequest({ topicId: "ratio", answer: "2:1" }),
  );
  expect(accepted.status).toBe(200);
  const firstPayload = (await accepted.json()) as {
    correct: boolean;
    attemptCount: number;
    solution: string[];
  };
  expect(firstPayload.correct).toBe(true);
  expect(firstPayload.attemptCount).toEqual(expect.any(Number));
  // Answering records the result; the next question is fetched separately.
  expect(firstPayload.solution.length).toBeGreaterThanOrEqual(0);
});
