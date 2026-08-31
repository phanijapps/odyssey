import { randomBytes, scryptSync } from "node:crypto";
import { expect, test } from "vitest";
import { authenticateChild } from "../../../../../../server/identity/identity";
import { learningDb } from "@odyssey/db";
import { GET, POST, DELETE } from "./route";

const PARENT = "6".repeat(32);
const OTHER_PARENT = "7".repeat(32);
const CHILD = "8".repeat(32);
const SCOPE = "child:sugg-route-child";

function provision(
  accountId: string,
  username: string,
  role: "parent" | "student",
): void {
  const salt = randomBytes(16);
  learningDb
    .prepare(
      `INSERT OR IGNORE INTO accounts (account_id, username, password_hash, salt, role)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(accountId, username, scryptSync("pass-word-1", salt, 32), salt, role);
}

function seedPlan(): void {
  learningDb
    .prepare(
      `INSERT OR IGNORE INTO test_sessions
        (id, learner_id, subject, grade, status, score, created_at, completed_at)
       VALUES ('sugg-route-test', ?, 'Mathematics', 'Grade 8', 'completed', 0, '2026-01-01', '2026-01-02')`,
    )
    .run(SCOPE);
  learningDb
    .prepare(
      `INSERT OR IGNORE INTO test_selected_records
        (test_session_id, selection_ordinal, gold_record_id, subject, grade,
         content_json, content_fingerprint)
       VALUES ('sugg-route-test', 1, 'sugg-route-gold', 'Mathematics', 'Grade 8', ?, 'fixture')`,
    )
    .run(
      JSON.stringify({
        subject: "Mathematics",
        gradeOrCourse: "Grade 8",
        domain: "Expressions",
        standardCode: "8.EE.7",
        standardText: "Use linear equations.",
      }),
    );
  learningDb
    .prepare(
      `INSERT OR IGNORE INTO test_questions
        (test_session_id, ordinal, gold_record_id, gold_content_fingerprint,
         planned_difficulty, correct, points, graded_at)
       VALUES ('sugg-route-test', 1, 'sugg-route-gold', 'fixture', 1, 0, 0, '2026-01-02')`,
    )
    .run();
}

function setup(): void {
  provision(PARENT, "sugg-route-parent", "parent");
  provision(OTHER_PARENT, "sugg-route-other", "parent");
  provision(CHILD, "sugg-route-child", "student");
  learningDb
    .prepare(
      `INSERT OR IGNORE INTO parent_child_links
        (parent_account_id, child_account_id, created_at, revoked_at)
       VALUES ('${PARENT}', '${CHILD}', 1, NULL)`,
    )
    .run();
  seedPlan();
}

async function parentSession(): Promise<string> {
  const parent = await authenticateChild({
    username: "sugg-route-parent",
    password: "pass-word-1",
  });
  return parent.sessionToken;
}

test("suggestion routes fail closed for bad principals and bodies", async () => {
  setup();
  const token = await parentSession();
  const other = await authenticateChild({
    username: "sugg-route-other",
    password: "pass-word-1",
  });
  const learner = await authenticateChild({
    username: "sugg-route-child",
    password: "pass-word-1",
  });

  const withCookie = (
    method: string,
    body?: unknown,
    cookie?: string,
    origin?: string,
  ) =>
    new Request(`http://localhost/api/parent/children/${CHILD}/suggestions`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(cookie ? { cookie } : {}),
        ...(origin ? { origin } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  // Anonymous and wrong roles.
  expect(
    (
      await GET(withCookie("GET"), {
        params: Promise.resolve({ childId: CHILD }),
      })
    ).status,
  ).toBe(401);
  expect(
    (
      await GET(
        withCookie("GET", undefined, `session=${learner.sessionToken}`),
        {
          params: Promise.resolve({ childId: CHILD }),
        },
      )
    ).status,
  ).toBe(403);
  // Unlinked parent.
  expect(
    (
      await GET(withCookie("GET", undefined, `session=${other.sessionToken}`), {
        params: Promise.resolve({ childId: CHILD }),
      })
    ).status,
  ).toBe(403);
  // Cross-origin mutation.
  expect(
    (
      await POST(
        withCookie(
          "POST",
          { standardCode: "8.EE.7" },
          `session=${token}`,
          "https://elsewhere.example",
        ),
        { params: Promise.resolve({ childId: CHILD }) },
      )
    ).status,
  ).toBe(403);
  // Malformed bodies.
  for (const body of [
    {},
    { standardCode: 7 },
    { standardCode: "8.EE.7", extra: 1 },
  ]) {
    expect(
      (
        await POST(
          withCookie("POST", body, `session=${token}`, "http://localhost"),
          { params: Promise.resolve({ childId: CHILD }) },
        )
      ).status,
    ).toBe(400);
  }
  // Bad child id shape.
  expect(
    (
      await GET(withCookie("GET", undefined, `session=${token}`), {
        params: Promise.resolve({ childId: "z" }),
      })
    ).status,
  ).toBe(403);
});

test("happy path with cookies: suggest, list, reject out-of-plan, cancel", async () => {
  setup();
  const token = await parentSession();
  const call = (method: string, body?: unknown) =>
    new Request(`http://localhost/api/parent/children/${CHILD}/suggestions`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        cookie: `session=${token}`,
        origin: "http://localhost",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  const created = await POST(call("POST", { standardCode: "8.EE.7" }), {
    params: Promise.resolve({ childId: CHILD }),
  });
  expect(created.status).toBe(201);
  expect(await created.json()).toEqual({
    standardCode: "8.EE.7",
    standardText: "Use linear equations.",
  });

  const listed = await GET(call("GET"), {
    params: Promise.resolve({ childId: CHILD }),
  });
  const body = await listed.json();
  expect(body.active).toEqual({
    standardCode: "8.EE.7",
    standardText: "Use linear equations.",
  });
  // Redaction: no topic ids or account ids in any parent-facing payload.
  expect(JSON.stringify(body)).not.toMatch(/topicId|accountId|assignmentToken/);

  const rejected = await POST(call("POST", { standardCode: "9.NS.1" }), {
    params: Promise.resolve({ childId: CHILD }),
  });
  expect(rejected.status).toBe(400);
  const still = await GET(call("GET"), {
    params: Promise.resolve({ childId: CHILD }),
  });
  expect((await still.json()).active?.standardCode).toBe("8.EE.7");

  const cancelled = await DELETE(call("DELETE"), {
    params: Promise.resolve({ childId: CHILD }),
  });
  expect(cancelled.status).toBe(204);
  const after = await GET(call("GET"), {
    params: Promise.resolve({ childId: CHILD }),
  });
  expect((await after.json()).active).toBeNull();
});
