import "server-only";

import { randomBytes } from "node:crypto";
import { getMistakeToMasteryPlan } from "./mistake-to-mastery";
import { learningDb } from "./sqlite-repository";

export type SuggestionState = {
  readonly recommended: readonly {
    readonly standardCode: string;
    readonly standardText: string;
  }[];
  readonly active: {
    readonly standardCode: string;
    readonly standardText: string;
  } | null;
};

type PlanItem = {
  readonly standardCode: string;
  readonly standardText: string;
  readonly topicId: string;
};

function currentPlan(childScopeKey: string): readonly PlanItem[] {
  return getMistakeToMasteryPlan(childScopeKey).items;
}

function appendEvent(
  suggestionId: string,
  actor: string,
  eventType:
    | "suggested"
    | "accepted"
    | "dismissed-by-child"
    | "cancelled-by-parent",
  now: number,
): void {
  // `actor` is the parent's account id for parent actions and the child's
  // scope key for child actions — both are durable principal strings.
  learningDb
    .prepare(
      `INSERT INTO parent_suggestion_events
         (suggestion_id, actor, event_type, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(suggestionId, actor, eventType, now);
}

/**
 * Read-side view for both portals: the child's current plan (the picker
 * list) and the active suggestion validated against that plan — a
 * suggestion whose standard left the plan is invisible to both sides.
 */
export function listSuggestionState(childScopeKey: string): SuggestionState {
  const plan = currentPlan(childScopeKey);
  const row = learningDb
    .prepare(
      `SELECT standard_code AS standardCode
       FROM parent_practice_suggestions
       WHERE child_scope = ? AND state = 'active'`,
    )
    .get(childScopeKey) as { standardCode: string } | undefined;
  const item = row
    ? plan.find((candidate) => candidate.standardCode === row.standardCode)
    : undefined;
  return {
    recommended: plan.map((candidate) => ({
      standardCode: candidate.standardCode,
      standardText: candidate.standardText,
    })),
    active: item
      ? { standardCode: item.standardCode, standardText: item.standardText }
      : null,
  };
}

/**
 * Suggests a plan skill for tonight's practice. One transaction: cancels
 * any active suggestion (auditing the supersede), inserts the new active
 * row, and appends the `suggested` audit event. Throws when the standard
 * is not in the child's current plan — with zero writes.
 */
export function suggestPractice(
  parentAccountId: string,
  childScopeKey: string,
  standardCode: string,
): { standardCode: string; standardText: string } {
  const item = currentPlan(childScopeKey).find(
    (candidate) => candidate.standardCode === standardCode,
  );
  if (!item) throw new Error("Standard is not in the child's current plan");

  const now = Date.now();
  learningDb.exec("BEGIN IMMEDIATE");
  try {
    const existing = learningDb
      .prepare(
        `SELECT id FROM parent_practice_suggestions
         WHERE child_scope = ? AND state = 'active'`,
      )
      .get(childScopeKey) as { id: string } | undefined;
    if (existing) {
      learningDb
        .prepare(
          `UPDATE parent_practice_suggestions
           SET state = 'cancelled', transitioned_at = ?
           WHERE id = ? AND state = 'active'`,
        )
        .run(now, existing.id);
      appendEvent(existing.id, parentAccountId, "cancelled-by-parent", now);
    }
    const id = randomBytes(16).toString("hex");
    learningDb
      .prepare(
        `INSERT INTO parent_practice_suggestions
           (id, child_scope, parent_account_id, topic_id, standard_code,
            template_key, state, created_at, transitioned_at)
         VALUES (?, ?, ?, ?, ?, 'practice-together', 'active', ?, ?)`,
      )
      .run(
        id,
        childScopeKey,
        parentAccountId,
        item.topicId,
        item.standardCode,
        now,
        now,
      );
    appendEvent(id, parentAccountId, "suggested", now);
    learningDb.exec("COMMIT");
  } catch (error) {
    learningDb.exec("ROLLBACK");
    throw error;
  }
  return { standardCode: item.standardCode, standardText: item.standardText };
}

/**
 * Child-side accept: transitions the active suggestion to accepted and
 * returns the learner's own practice target. Null (no audit row) when no
 * suggestion is active — cancelled, dismissed, already accepted, or
 * superseded.
 */
export function acceptSuggestion(
  childScopeKey: string,
): { topicId: string; standardCode: string } | null {
  return transitionActive(childScopeKey, childScopeKey, "accepted", "accepted");
}

/** Child-side quiet dismissal. False (no audit row) when nothing is active. */
export function dismissSuggestion(childScopeKey: string): boolean {
  return (
    transitionActive(
      childScopeKey,
      childScopeKey,
      "dismissed",
      "dismissed-by-child",
    ) !== null
  );
}

/** Parent-side cancel of the child's active suggestion. False when none. */
export function cancelSuggestion(
  parentAccountId: string,
  childScopeKey: string,
): boolean {
  return (
    transitionActive(
      childScopeKey,
      parentAccountId,
      "cancelled",
      "cancelled-by-parent",
    ) !== null
  );
}

function transitionActive(
  childScopeKey: string,
  actorAccountId: string,
  state: "accepted" | "dismissed" | "cancelled",
  eventType: "accepted" | "dismissed-by-child" | "cancelled-by-parent",
): { topicId: string; standardCode: string } | null {
  const now = Date.now();
  learningDb.exec("BEGIN IMMEDIATE");
  try {
    const row = learningDb
      .prepare(
        `SELECT id, topic_id AS topicId, standard_code AS standardCode
         FROM parent_practice_suggestions
         WHERE child_scope = ? AND state = 'active'`,
      )
      .get(childScopeKey) as
      | {
          id: string;
          topicId: string;
          standardCode: string;
        }
      | undefined;
    if (!row) {
      learningDb.exec("COMMIT");
      return null;
    }
    learningDb
      .prepare(
        `UPDATE parent_practice_suggestions
         SET state = ?, transitioned_at = ?
         WHERE id = ? AND state = 'active'`,
      )
      .run(state, now, row.id);
    appendEvent(row.id, actorAccountId, eventType, now);
    learningDb.exec("COMMIT");
    return { topicId: row.topicId, standardCode: row.standardCode };
  } catch (error) {
    learningDb.exec("ROLLBACK");
    throw error;
  }
}

/**
 * Cancels the child's active suggestions for the link-revocation path.
 * The caller owns the transaction: call between its BEGIN IMMEDIATE and
 * COMMIT so the revoke and the cancellation commit atomically.
 */
export function cancelSuggestionsForChild(
  parentAccountId: string,
  childScopeKey: string,
): void {
  const now = Date.now();
  const rows = learningDb
    .prepare(
      `SELECT id FROM parent_practice_suggestions
       WHERE child_scope = ? AND state = 'active'`,
    )
    .all(childScopeKey) as Array<{ id: string }>;
  for (const row of rows) {
    learningDb
      .prepare(
        `UPDATE parent_practice_suggestions
         SET state = 'cancelled', transitioned_at = ?
         WHERE id = ? AND state = 'active'`,
      )
      .run(now, row.id);
    appendEvent(row.id, parentAccountId, "cancelled-by-parent", now);
  }
}
