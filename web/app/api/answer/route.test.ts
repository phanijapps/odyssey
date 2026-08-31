import { expect, test } from "vitest";
import { authenticateChild } from "../../../server/identity/identity";
import { getLearningProgress } from "../../../server/learning/learning";
import { GET as progressGET } from "../progress/route";
import { POST } from "./route";

const TOPIC = "ratio";

type Session = Awaited<ReturnType<typeof authenticateChild>>;

function answerRequest(session: Session, body: unknown): Request {
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

async function issueAssignment(
  session: Session,
  topicId = TOPIC,
): Promise<string> {
  const response = await progressGET(
    new Request(`http://localhost/api/progress?topicId=${topicId}`, {
      headers: { cookie: `session=${session.sessionToken}` },
    }),
  );
  expect(response.status).toBe(200);
  const payload = (await response.json()) as {
    nextQuestion: { assignmentToken: string } | null;
  };
  expect(payload.nextQuestion?.assignmentToken).toMatch(/^[A-Za-z0-9_-]{32,}$/);
  return payload.nextQuestion!.assignmentToken;
}

test("requires the opaque assignmentToken in the answer DTO", async () => {
  const session = await authenticateChild({
    username: "test-learner",
    password: "test-learner-password",
  });
  const token = await issueAssignment(session);

  const missingToken = await POST(
    answerRequest(session, { topicId: TOPIC, answer: "2:1" }),
  );
  expect(missingToken.status).toBe(400);
  expect(missingToken.headers.get("cache-control")).toBe("no-store");
  expect(
    (
      await POST(
        answerRequest(session, {
          topicId: TOPIC,
          answer: "2:1",
          assignmentToken: token,
          level: 13,
        }),
      )
    ).status,
  ).toBe(400);

  const accepted = await POST(
    answerRequest(session, {
      topicId: TOPIC,
      answer: "2:1",
      assignmentToken: token,
    }),
  );
  expect(accepted.status).toBe(200);
  expect(accepted.headers.get("cache-control")).toBe("no-store");
  const payload = (await accepted.json()) as {
    correct: boolean;
    attemptCount: number;
    solution: string[];
  };
  expect(payload.correct).toEqual(expect.any(Boolean));
  expect(payload.attemptCount).toBe(1);
  expect(payload.solution.length).toBeGreaterThanOrEqual(0);
});

test("rejects fabricated and replayed Practice tokens without another attempt", async () => {
  const session = await authenticateChild({
    username: "test-learner",
    password: "test-learner-password",
  });
  const token = await issueAssignment(session, "replay-ratio");
  const fabricated = await POST(
    answerRequest(session, {
      topicId: "replay-ratio",
      answer: "2:1",
      assignmentToken: "x".repeat(43),
    }),
  );
  expect(fabricated.status).toBe(400);
  expect(getLearningProgress(session.childId, "replay-ratio")).toBeNull();

  const first = await POST(
    answerRequest(session, {
      topicId: "replay-ratio",
      answer: "2:1",
      assignmentToken: token,
    }),
  );
  expect(first.status).toBe(200);
  const replay = await POST(
    answerRequest(session, {
      topicId: "replay-ratio",
      answer: "2:1",
      assignmentToken: token,
    }),
  );
  expect(replay.status).toBe(400);
  expect(getLearningProgress(session.childId, "replay-ratio")).toMatchObject({
    attemptCount: 1,
  });
});

test("concurrent submissions consume an assignment exactly once and persist difficulty", async () => {
  const session = await authenticateChild({
    username: "test-learner",
    password: "test-learner-password",
  });
  const topicId = "concurrent-ratio";
  const token = await issueAssignment(session, topicId);
  const [first, second] = await Promise.all([
    POST(
      answerRequest(session, {
        topicId,
        answer: "2:1",
        assignmentToken: token,
      }),
    ),
    POST(
      answerRequest(session, {
        topicId,
        answer: "2:1",
        assignmentToken: token,
      }),
    ),
  ]);
  expect([first.status, second.status].sort()).toEqual([200, 400]);
  expect(getLearningProgress(session.childId, topicId)).toMatchObject({
    attemptCount: 1,
  });

  const next = await progressGET(
    new Request(`http://localhost/api/progress?topicId=${topicId}`, {
      headers: { cookie: `session=${session.sessionToken}` },
    }),
  );
  const payload = (await next.json()) as {
    poolProgress: { difficulty: number };
  };
  // The seeded question starts medium; a correct submission persists hard.
  expect(payload.poolProgress.difficulty).toBe(3);
});
