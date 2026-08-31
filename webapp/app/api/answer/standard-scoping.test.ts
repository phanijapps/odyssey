import { expect, test } from "vitest";
import {
  authenticateAccount,
  setSessionPool,
} from "../../../server/identity/identity";
import { withGoldDatabase } from "@odyssey/db";
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
    body: JSON.stringify({
      topicId: TOPIC,
      answer: ans,
      assignmentToken: "a".repeat(43),
    }),
  });
}

test("after answering, the next fetched question stays on the standard", async () => {
  const session = await authenticateAccount({
    username: "test-learner",
    password: "test-learner-password",
  });
  const token = session.sessionToken;
  // The standard fixture belongs to this test's isolated curriculum database;
  // never borrow whatever curriculum an interactive local server has loaded.
  withGoldDatabase((database) => {
    database
      .prepare(
        `INSERT INTO gold_curriculum_records
          (record_id, subject, framework, content_json, source_fingerprint,
           prompt_version, model, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "standard-scope-8-ee-6",
        "Mathematics",
        "fixture",
        JSON.stringify({
          id: "standard-scope-8-ee-6",
          subject: "Mathematics",
          gradeOrCourse: "Grade 8",
          domain: "Expressions and Equations",
          standardCode: "8.EE.6",
          standardText:
            "Use similar triangles to explain why the slope m is the same between any two distinct points on a non-vertical line in the coordinate plane.",
          topics: ["linear"],
          source: { documentId: "fixture", page: 1 },
        }),
        "fixture",
        "v1",
        "fixture",
        "2026-01-01",
      );
  });

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
    mode: "practice",
    activeAssignment: { questionId: "seed-1", token: "a".repeat(43) },
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
    q,
  ).toBe(true);
  expect(lower).not.toContain("evaluate the expression");
  expect(lower).not.toContain("exponent");
});
