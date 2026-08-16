import { expect, test } from "vitest";
import {
  authenticateChild,
  setSessionPool,
} from "../../../server/identity/identity";
import { POST } from "./route";
import { GET as progressGET } from "../progress/route";

const TOPIC = "Mathematics::Grade 8::Expressions and Equations::8.EE.6";

function request(token: string, ans: string) {
  return new Request("http://localhost/api/answer", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `session=${token}`,
      origin: "http://localhost",
    },
    body: JSON.stringify({ topicId: TOPIC, answer: ans }),
  });
}

test("after answering, the next fetched question stays on the standard", async () => {
  const session = await authenticateChild({
    username: "demo",
    password: "demo",
  });
  const token = session.sessionToken;

  // Seed a one-question pool for 8.EE.6 so answering has an active question.
  setSessionPool(request(token, "seed"), {
    topicId: TOPIC,
    questions: [
      {
        id: "seed-1",
        question: "What is the slope between (1,2) and (3,6)?",
        answer: "2",
        acceptableAnswers: [],
        hint: "Rise over run.",
        solution: ["Slope = rise / run.", "Slope = 4 / 2 = 2."],
        diagramSvg:
          '<svg xmlns="http://www.w3.org/2000/svg" aria-label="d" viewBox="0 0 100 60"><line x1="10" y1="50" x2="90" y2="10" stroke="#333333" stroke-width="2" /></svg>',
        difficulty: 2,
      },
    ],
    shownIds: ["seed-1"],
    currentDifficulty: 2,
    batchPosition: 1,
    batchSize: 6,
  });

  const response = await POST(request(token, "2"));
  expect(response.status).toBe(200);
  const payload = (await response.json()) as {
    correct: boolean;
    solution: string[];
  };
  expect(payload.correct).toBe(true);
  expect(payload.solution.length).toBeGreaterThan(0);

  // The client then fetches the next question (Next button) — it must stay
  // on 8.EE.6, never leaking into expression evaluation or exponents.
  const progressResponse = await progressGET(
    new Request(
      `http://localhost/api/progress?subject=Mathematics&grade=Grade%208&domain=Expressions%20and%20Equations&standard=8.EE.6&topicId=${encodeURIComponent(TOPIC)}&mode=practice`,
      { headers: { cookie: `session=${token}` } },
    ),
  );
  expect(progressResponse.status).toBe(200);
  const next = (await progressResponse.json()) as {
    nextQuestion?: { question?: string } | null;
  };
  const q = next.nextQuestion?.question ?? "";
  expect(q.length).toBeGreaterThan(0);
  const lower = q.toLowerCase();
  expect(
    lower.includes("slope") ||
      lower.includes("triangle") ||
      lower.includes("line") ||
      lower.includes("coordinate") ||
      lower.includes("y =") ||
      lower.includes("rate"),
  ).toBe(true);
  expect(lower).not.toContain("evaluate the expression");
  expect(lower).not.toContain("exponent");
});
