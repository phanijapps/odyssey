import { randomBytes, scryptSync } from "node:crypto";
import { beforeAll, expect, test } from "vitest";
import { authenticateChild } from "../../../../server/identity/identity";
import { learningDb } from "@odyssey/db";
import { GET } from "./route";

function provisionAccount(
  accountId: string,
  username: string,
  password: string,
  role: "parent" | "student",
): void {
  const salt = randomBytes(16);
  learningDb
    .prepare(
      `INSERT INTO accounts (account_id, username, password_hash, salt, role)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(accountId, username, scryptSync(password, salt, 32), salt, role);
}

const PARENT = {
  accountId: "4".repeat(32),
  username: "preview-parent",
  password: "parent-password",
};
const CHILD = {
  accountId: "5".repeat(32),
  username: "preview-child",
  password: "child-password",
};

function provisionLinkedFamily(): void {
  provisionAccount(
    PARENT.accountId,
    PARENT.username,
    PARENT.password,
    "parent",
  );
  provisionAccount(CHILD.accountId, CHILD.username, CHILD.password, "student");
  learningDb
    .prepare(
      `INSERT INTO parent_child_links
        (parent_account_id, child_account_id, created_at, revoked_at)
       VALUES (?, ?, 1, NULL)`,
    )
    .run(PARENT.accountId, CHILD.accountId);
}

function seedChildRecommendedTarget(): void {
  learningDb
    .prepare(
      `INSERT INTO test_sessions
        (id, learner_id, subject, grade, status, score, created_at, completed_at)
       VALUES (?, ?, 'Mathematics', 'Grade 6', 'completed', 0, '2026-03-01', '2026-03-01')`,
    )
    .run(`${CHILD.accountId}-session`, `child:${CHILD.username}`);
  learningDb
    .prepare(
      `INSERT INTO test_selected_records
        (test_session_id, selection_ordinal, gold_record_id, subject, grade,
         content_json, content_fingerprint)
       VALUES (?, 1, 'preview-fixture', 'Mathematics', 'Grade 6', ?, 'fixture')`,
    )
    .run(
      `${CHILD.accountId}-session`,
      JSON.stringify({
        subject: "Mathematics",
        gradeOrCourse: "Grade 6",
        domain: "Ratios and Proportional Relationships",
        standardCode: "6.RP.A.1",
        standardText:
          "Understand the concept of a ratio and use ratio language to describe a ratio relationship between two quantities.",
      }),
    );
  learningDb
    .prepare(
      `INSERT INTO test_questions
        (test_session_id, ordinal, gold_record_id, gold_content_fingerprint,
         planned_difficulty, correct, points, graded_at)
       VALUES (?, 1, 'preview-fixture', 'fixture', 1, 0, 0, '2026-03-01')`,
    )
    .run(`${CHILD.accountId}-session`);
}

function snapshotLearningState(): string {
  return JSON.stringify({
    attempts: learningDb
      .prepare("SELECT * FROM learning_attempts ORDER BY rowid")
      .all(),
    progress: learningDb
      .prepare("SELECT * FROM learning_progress ORDER BY rowid")
      .all(),
    tests: learningDb
      .prepare("SELECT * FROM test_sessions ORDER BY rowid")
      .all(),
    questions: learningDb
      .prepare("SELECT * FROM test_questions ORDER BY rowid")
      .all(),
    // auth_sessions.last_seen legitimately advances on session activity; the
    // pool and request counters beside it must not change.
    sessions: learningDb
      .prepare(
        "SELECT token_hash, question_pool, generated_requests FROM auth_sessions ORDER BY token_hash",
      )
      .all(),
  });
}

function parentRequest(): Request {
  return new Request("http://localhost/api/parent/preview", {
    headers: { cookie: `session=${parentToken}` },
  });
}

let parentToken = "";

beforeAll(async () => {
  provisionLinkedFamily();
  const parent = await authenticateChild({
    username: PARENT.username,
    password: PARENT.password,
  });
  parentToken = parent.sessionToken;
});

test("practice preview is parent-only and no-store", async () => {
  expect(GET(new Request("http://localhost/api/parent/preview")).status).toBe(
    401,
  );
  const learner = await authenticateChild({
    username: "test-learner",
    password: "test-learner-password",
  });
  expect(
    GET(
      new Request("http://localhost/api/parent/preview", {
        headers: { cookie: `session=${learner.sessionToken}` },
      }),
    ).status,
  ).toBe(403);
  const admin = await authenticateChild({
    username: "test-admin",
    password: "test-admin-password",
  });
  expect(
    GET(
      new Request("http://localhost/api/parent/preview", {
        headers: { cookie: `session=${admin.sessionToken}` },
      }),
    ).status,
  ).toBe(403);
});

test("preview with no linked recommended target is an honest empty state", async () => {
  const response = GET(parentRequest());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  await expect(response.json()).resolves.toEqual({ preview: null });
});

test("practice preview returns a reviewed sample without any answer material", async () => {
  seedChildRecommendedTarget();
  const response = GET(parentRequest());
  expect(response.status).toBe(200);
  const body = (await response.json()) as { preview: Record<string, unknown> };
  expect(body.preview.childUsername).toBe(CHILD.username);
  expect(body.preview.standardCode).toBe("6.RP.A.1");
  expect(String(body.preview.question)).toContain("ratio");
  expect(JSON.stringify(body)).not.toMatch(
    /expectedAnswer|acceptableAnswers|hint|solution|assignmentToken|correctAnswer/i,
  );
});

test("practice preview never mutates child or session state", async () => {
  const before = snapshotLearningState();
  const response = GET(parentRequest());
  expect(response.status).toBe(200);
  expect(snapshotLearningState()).toBe(before);
});
