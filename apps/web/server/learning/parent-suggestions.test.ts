import { expect, test } from "vitest";
import { learningDb } from "@odyssey/db";
import {
  acceptSuggestion,
  cancelSuggestion,
  cancelSuggestionsForChild,
  dismissSuggestion,
  listSuggestionState,
  suggestPractice,
} from "./parent-suggestions";

// Distinct principals per test: the suite shares one database, and the
// read-side helpers scope by child, so isolation comes from unique tags.
function seedAccounts(tag: string): {
  parent: string;
  scope: string;
} {
  const parent = `p-${tag}`.padEnd(32, "0");
  learningDb
    .prepare(
      `INSERT OR IGNORE INTO accounts (account_id, username, password_hash, salt, role)
       VALUES (?, ?, x'00', x'00', 'parent')`,
    )
    .run(parent, `sugg-parent-${tag}`);
  return { parent, scope: `child:sugg-${tag}` };
}

function seedPlan(
  sessionId: string,
  scope: string,
  standardCodes: string[],
): void {
  learningDb
    .prepare(
      `INSERT INTO test_sessions
        (id, learner_id, subject, grade, status, score, created_at, completed_at)
       VALUES (?, ?, 'Mathematics', 'Grade 8', 'completed', 0, '2026-01-01', '2026-01-02')`,
    )
    .run(sessionId, scope);
  standardCodes.forEach((standardCode, index) => {
    learningDb
      .prepare(
        `INSERT INTO test_selected_records
          (test_session_id, selection_ordinal, gold_record_id, subject, grade,
           content_json, content_fingerprint)
         VALUES (?, ?, 'sugg-gold-${standardCode}', 'Mathematics', 'Grade 8', ?, 'fixture')`,
      )
      .run(
        sessionId,
        index + 1,
        JSON.stringify({
          subject: "Mathematics",
          gradeOrCourse: "Grade 8",
          domain: "Expressions",
          standardCode,
          standardText: `Practice ${standardCode}.`,
        }),
      );
    learningDb
      .prepare(
        `INSERT INTO test_questions
          (test_session_id, ordinal, gold_record_id, gold_content_fingerprint,
           planned_difficulty, correct, points, graded_at)
         VALUES (?, ?, 'sugg-gold-${standardCode}', 'fixture', 1, 0, 0, '2026-01-02')`,
      )
      .run(sessionId, index + 1);
  });
}

function events(child: string): Array<{ event_type: string }> {
  return learningDb
    .prepare(
      `SELECT event_type FROM parent_suggestion_events
       WHERE suggestion_id IN
         (SELECT id FROM parent_practice_suggestions WHERE child_scope = ?)
       ORDER BY id`,
    )
    .all(child) as Array<{ event_type: string }>;
}

test("suggests from the current plan, supersedes, and audits every transition", () => {
  const { parent: PARENT, scope: CHILD_SCOPE } = seedAccounts("one");
  seedPlan("sugg-test-1", CHILD_SCOPE, ["8.EE.7", "8.EE.9"]);

  const state = listSuggestionState(CHILD_SCOPE);
  expect(state.active).toBeNull();
  expect(state.recommended.map((item) => item.standardCode)).toEqual([
    "8.EE.7",
    "8.EE.9",
  ]);

  expect(suggestPractice(PARENT, CHILD_SCOPE, "8.EE.7")).toEqual({
    standardCode: "8.EE.7",
    standardText: "Practice 8.EE.7.",
  });
  expect(listSuggestionState(CHILD_SCOPE).active).toEqual({
    standardCode: "8.EE.7",
    standardText: "Practice 8.EE.7.",
  });

  // Supersede: old cancelled + audited, new active + audited.
  suggestPractice(PARENT, CHILD_SCOPE, "8.EE.9");
  expect(listSuggestionState(CHILD_SCOPE).active?.standardCode).toBe("8.EE.9");
  const ids = learningDb
    .prepare(
      `SELECT suggestion_id FROM parent_suggestion_events WHERE suggestion_id IN
         (SELECT id FROM parent_practice_suggestions WHERE child_scope = ?)
       ORDER BY id`,
    )
    .all(CHILD_SCOPE)
    .map((row) => (row as { suggestion_id: string }).suggestion_id);
  expect(events(CHILD_SCOPE).map((event) => event.event_type)).toEqual([
    "suggested",
    "cancelled-by-parent",
    "suggested",
  ]);
  expect(new Set(ids).size).toBe(2);

  // Plan rejection: zero writes, existing suggestion intact.
  expect(() => suggestPractice(PARENT, CHILD_SCOPE, "9.NS.1")).toThrow(
    "Standard is not in the child's current plan",
  );
  expect(listSuggestionState(CHILD_SCOPE).active?.standardCode).toBe("8.EE.9");
});

test("child accept returns the topic and audits; repeated acts miss", () => {
  const { parent: PARENT, scope: CHILD_SCOPE } = seedAccounts("two");
  seedPlan("sugg-test-accept", CHILD_SCOPE, ["8.EE.7"]);
  suggestPractice(PARENT, CHILD_SCOPE, "8.EE.7");

  const accepted = acceptSuggestion(CHILD_SCOPE);
  expect(accepted?.standardCode).toBe("8.EE.7");
  expect(accepted?.topicId).toBe("Mathematics::Grade 8::Expressions::8.EE.7");
  expect(events(CHILD_SCOPE).map((event) => event.event_type)).toEqual([
    "suggested",
    "accepted",
  ]);
  expect(acceptSuggestion(CHILD_SCOPE)).toBeNull();
  expect(events(CHILD_SCOPE)).toHaveLength(2);
});

test("child dismissal and parent cancellation are quiet and audited", () => {
  const { parent: PARENT, scope: CHILD_SCOPE } = seedAccounts("three");
  seedPlan("sugg-test-dismiss", CHILD_SCOPE, ["8.EE.7"]);
  suggestPractice(PARENT, CHILD_SCOPE, "8.EE.7");

  expect(dismissSuggestion(CHILD_SCOPE)).toBe(true);
  expect(dismissSuggestion(CHILD_SCOPE)).toBe(false);
  expect(events(CHILD_SCOPE).map((event) => event.event_type)).toEqual([
    "suggested",
    "dismissed-by-child",
  ]);

  suggestPractice(PARENT, CHILD_SCOPE, "8.EE.7");
  expect(cancelSuggestion(PARENT, CHILD_SCOPE)).toBe(true);
  expect(cancelSuggestion(PARENT, CHILD_SCOPE)).toBe(false);
  expect(events(CHILD_SCOPE).map((event) => event.event_type)).toEqual([
    "suggested",
    "dismissed-by-child",
    "suggested",
    "cancelled-by-parent",
  ]);
});

test("a plan-evicted active suggestion is invisible to both sides", () => {
  const { parent: PARENT, scope: CHILD_SCOPE } = seedAccounts("four");
  seedPlan("sugg-test-evict", CHILD_SCOPE, ["8.EE.7"]);
  suggestPractice(PARENT, CHILD_SCOPE, "8.EE.7");
  // A newer completed Test evicts the old snapshot standard from the plan.
  learningDb
    .prepare(
      `INSERT INTO test_sessions
        (id, learner_id, subject, grade, status, score, created_at, completed_at)
       VALUES ('sugg-test-evict-newer', ?, 'Mathematics', 'Grade 8', 'completed', 0, '2026-01-01', '2026-02-01')`,
    )
    .run(CHILD_SCOPE);
  learningDb
    .prepare(
      `INSERT INTO test_selected_records
        (test_session_id, selection_ordinal, gold_record_id, subject, grade,
         content_json, content_fingerprint)
       VALUES ('sugg-test-evict-newer', 1, 'sugg-gold-new', 'Mathematics', 'Grade 8', ?, 'fixture')`,
    )
    .run(
      JSON.stringify({
        subject: "Mathematics",
        gradeOrCourse: "Grade 8",
        domain: "Geometry",
        standardCode: "8.G.1",
        standardText: "Practice 8.G.1.",
      }),
    );
  learningDb
    .prepare(
      `INSERT INTO test_questions
        (test_session_id, ordinal, gold_record_id, gold_content_fingerprint,
         planned_difficulty, correct, points, graded_at)
       VALUES ('sugg-test-evict-newer', 1, 'sugg-gold-new', 'fixture', 1, 0, 0, '2026-02-01')`,
    )
    .run();

  const state = listSuggestionState(CHILD_SCOPE);
  expect(state.active).toBeNull();
  expect(state.recommended.map((item) => item.standardCode)).toEqual(["8.G.1"]);
});

test("cancelSuggestionsForChild runs inside the caller's transaction", () => {
  const { parent: PARENT, scope: CHILD_SCOPE } = seedAccounts("five");
  seedPlan("sugg-test-revoke", CHILD_SCOPE, ["8.EE.7"]);
  suggestPractice(PARENT, CHILD_SCOPE, "8.EE.7");

  learningDb.exec("BEGIN IMMEDIATE");
  try {
    cancelSuggestionsForChild(PARENT, CHILD_SCOPE);
    learningDb.exec("COMMIT");
  } catch (error) {
    learningDb.exec("ROLLBACK");
    throw error;
  }
  expect(listSuggestionState(CHILD_SCOPE).active).toBeNull();
  expect(events(CHILD_SCOPE).map((event) => event.event_type)).toEqual([
    "suggested",
    "cancelled-by-parent",
  ]);
});
