import { randomBytes, scryptSync } from "node:crypto";
import { expect, test } from "vitest";
import { authenticateChild } from "../../../server/identity/identity";
import { learningDb } from "@odyssey/db";
import { suggestPractice } from "../../../server/learning/parent-suggestions";
import { GET } from "./route";
import { POST as POST_ACCEPT } from "./accept/route";
import { POST as POST_DISMISS } from "./dismiss/route";

const PARENT = "9".repeat(32);
const CHILD = "a".repeat(32);
const SCOPE = "child:sugg-child-route";

function setup(): Promise<string> {
  const salt = randomBytes(16);
  learningDb
    .prepare(
      `INSERT OR IGNORE INTO accounts (account_id, username, password_hash, salt, role)
       VALUES ('${PARENT}', 'sugg-cr-parent', x'00', x'00', 'parent')`,
    )
    .run();
  learningDb
    .prepare(
      `INSERT OR IGNORE INTO accounts (account_id, username, password_hash, salt, role)
       VALUES (?, 'sugg-child-route', ?, ?, 'student')`,
    )
    .run(CHILD, scryptSync("child-pass-1", salt, 32), salt);
  learningDb
    .prepare(
      `INSERT OR IGNORE INTO parent_child_links
        (parent_account_id, child_account_id, created_at, revoked_at)
       VALUES ('${PARENT}', '${CHILD}', 1, NULL)`,
    )
    .run();
  learningDb
    .prepare(
      `INSERT OR IGNORE INTO test_sessions
        (id, learner_id, subject, grade, status, score, created_at, completed_at)
       VALUES ('sugg-child-route-test', ?, 'Mathematics', 'Grade 8', 'completed', 0, '2026-01-01', '2026-01-02')`,
    )
    .run(SCOPE);
  learningDb
    .prepare(
      `INSERT OR IGNORE INTO test_selected_records
        (test_session_id, selection_ordinal, gold_record_id, subject, grade,
         content_json, content_fingerprint)
       VALUES ('sugg-child-route-test', 1, 'sugg-cr-gold', 'Mathematics', 'Grade 8', ?, 'fixture')`,
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
       VALUES ('sugg-child-route-test', 1, 'sugg-cr-gold', 'fixture', 1, 0, 0, '2026-01-02')`,
    )
    .run();
  return authenticateChild({
    username: "sugg-child-route",
    password: "child-pass-1",
  }).then((session) => session.sessionToken);
}

const mutationHeaders = {
  "content-type": "application/json",
  origin: "http://localhost",
};

test("child reads, accepts, and dismisses their own suggestion", async () => {
  const token = await setup();
  const cookie = { cookie: `session=${token}` };

  const empty = await GET(
    new Request("http://localhost/api/suggested-practice", { headers: cookie }),
  );
  expect(empty.status).toBe(200);
  expect(empty.headers.get("cache-control")).toBe("no-store");
  expect(await empty.json()).toEqual({ suggestion: null });

  suggestPractice(PARENT, SCOPE, "8.EE.7");
  const visible = await GET(
    new Request("http://localhost/api/suggested-practice", { headers: cookie }),
  );
  expect(await visible.json()).toEqual({
    suggestion: {
      standardCode: "8.EE.7",
      standardText: "Use linear equations.",
    },
  });

  const accepted = await POST_ACCEPT(
    new Request("http://localhost/api/suggested-practice/accept", {
      method: "POST",
      headers: { ...mutationHeaders, ...cookie },
    }),
  );
  expect(accepted.status).toBe(201);
  const acceptedBody = await accepted.json();
  expect(acceptedBody.standardCode).toBe("8.EE.7");
  expect(acceptedBody.topicId).toBe(
    "Mathematics::Grade 8::Expressions::8.EE.7",
  );
  expect(
    (
      await POST_ACCEPT(
        new Request("http://localhost/api/suggested-practice/accept", {
          method: "POST",
          headers: { ...mutationHeaders, ...cookie },
        }),
      )
    ).status,
  ).toBe(404);

  suggestPractice(PARENT, SCOPE, "8.EE.7");
  const dismissed = await POST_DISMISS(
    new Request("http://localhost/api/suggested-practice/dismiss", {
      method: "POST",
      headers: { ...mutationHeaders, ...cookie },
    }),
  );
  expect(dismissed.status).toBe(204);
  expect(
    (
      await POST_DISMISS(
        new Request("http://localhost/api/suggested-practice/dismiss", {
          method: "POST",
          headers: { ...mutationHeaders, ...cookie },
        }),
      )
    ).status,
  ).toBe(404);
});

test("suggested-practice routes fail closed", async () => {
  await setup();
  expect(
    (await GET(new Request("http://localhost/api/suggested-practice"))).status,
  ).toBe(401);
  const parentSalt = randomBytes(16);
  learningDb
    .prepare(
      `INSERT OR IGNORE INTO accounts (account_id, username, password_hash, salt, role)
       VALUES ('${"b".repeat(32)}', 'sugg-cr-signin-parent', ?, ?, 'parent')`,
    )
    .run(scryptSync("parent-pass-1", parentSalt, 32), parentSalt);
  const parent = await authenticateChild({
    username: "sugg-cr-signin-parent",
    password: "parent-pass-1",
  });
  expect(
    (
      await GET(
        new Request("http://localhost/api/suggested-practice", {
          headers: { cookie: `session=${parent.sessionToken}` },
        }),
      )
    ).status,
  ).toBe(403);
  // Anonymous mutations fail the proof (house behavior: proof-required 403,
  // same as every learner mutation route).
  expect(
    (
      await POST_ACCEPT(
        new Request("http://localhost/api/suggested-practice/accept", {
          method: "POST",
          headers: mutationHeaders,
        }),
      )
    ).status,
  ).toBe(403);
});
