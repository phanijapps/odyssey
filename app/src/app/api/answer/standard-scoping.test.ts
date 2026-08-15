import { expect, test } from "vitest";
import {
  authenticateChild,
  setSessionPool,
} from "../../../server/identity/identity";
import { POST } from "./route";

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

test("next question stays on the selected standard across answers", async () => {
  const session = await authenticateChild({
    username: "demo",
    password: "demo",
  });
  const token = session.sessionToken;

  // Seed a one-question pool for 8.EE.6 so the lazy branch runs.
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
    nextQuestion?: { question?: string } | null;
  };
  const q = payload.nextQuestion?.question ?? "";
  expect(q.length).toBeGreaterThan(0);
  const lower = q.toLowerCase();
  // 8.EE.6 is slope via similar triangles — the next question must stay there,
  // not leak into expression evaluation or exponents (the domain's other skills).
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
  expect(lower).not.toContain("3x + 5");
});
