import "server-only";
import { createHash, randomUUID } from "node:crypto";
import {
  resolveGoldRecordsForAssessment,
  type ResolvedGoldRecord,
} from "../curriculum/gold-query";
import { checkAnswer } from "@odyssey/practice-engine";
import {
  learnerQuestionInteractionSchema,
  textResponseInteraction,
  type LearnerQuestionInteraction,
} from "@odyssey/practice-engine";
import { validateLearningPayload } from "../validation/payloads";
import { learningDb, withLearningTransaction } from "./sqlite-repository";

const DIFFICULTY_PLAN = [1, 1, 1, 2, 2, 2, 3, 3, 3] as const;
const PREPARATION_LEASE_MS = 30_000;

type AssessmentActor = {
  readonly learnerId: string;
  readonly role: string;
};

type SessionRow = {
  id: string;
  learner_id: string;
  subject: string;
  grade: string;
  status: "active" | "completed" | "partial";
  score: number;
  created_at: string;
  completed_at: string | null;
};

const SESSION_PROJECTION =
  "id, learner_id, subject, grade, status, score, created_at, completed_at";

type QuestionRow = {
  ordinal: number;
  gold_record_id: string;
  gold_content_fingerprint: string;
  planned_difficulty: number;
  preparation_status: "pending" | "preparing" | "ready" | "unavailable";
  preparation_lease_token: string | null;
  preparation_lease_until: number | null;
  question_payload_json: string | null;
  expected_answer: string | null;
  acceptable_answers_json: string | null;
  assignment_token: string | null;
  correct: number | null;
  points: number | null;
};

export type AssessmentQuestionState = {
  readonly ordinal: number;
  readonly goldRecordId: string;
  readonly goldContentFingerprint: string;
  readonly plannedDifficulty: 1 | 2 | 3;
  readonly preparationStatus: "pending" | "preparing" | "ready" | "unavailable";
  readonly answered: boolean;
};

export type AssessmentState = {
  readonly id: string;
  readonly subject: string;
  readonly grade: string;
  readonly status: "active" | "completed" | "partial";
  readonly score: number;
  readonly completedAt: string | null;
  readonly selectedRecords: readonly {
    readonly recordId: string;
    readonly contentFingerprint: string;
    readonly content: unknown;
  }[];
  readonly questions: readonly AssessmentQuestionState[];
};

export type AssessmentResult = {
  readonly id: string;
  readonly subject: string;
  readonly grade: string;
  readonly status: "completed" | "partial";
  readonly score: number;
  readonly completedAt: string;
  readonly questions: readonly {
    readonly ordinal: number;
    readonly question: unknown;
    readonly correct: boolean;
    readonly points: number;
    readonly correctAnswer: string;
  }[];
};

export type AssessmentQuestionPayload = {
  readonly question: string;
  readonly answer: string;
  readonly acceptableAnswers?: readonly string[];
  readonly hint?: string;
  readonly solution?: readonly string[];
  readonly diagramSvg?: string;
  readonly [key: string]: unknown;
};

function assertLearner(actor: AssessmentActor): void {
  if (!actor.learnerId || actor.role !== "student")
    throw new Error("Assessment access required");
}

function isTerminalStatus(
  status: SessionRow["status"],
): status is "completed" | "partial" {
  return status === "completed" || status === "partial";
}

function toState(
  session: SessionRow,
  questions: QuestionRow[],
): AssessmentState {
  const selected = learningDb
    .prepare(
      `SELECT gold_record_id, content_fingerprint, content_json
       FROM test_selected_records WHERE test_session_id = ?
       ORDER BY selection_ordinal`,
    )
    .all(session.id) as Array<{
    gold_record_id: string;
    content_fingerprint: string;
    content_json: string;
  }>;
  return {
    id: session.id,
    subject: session.subject,
    grade: session.grade,
    status: session.status,
    // Score remains server-side until a completed-result projection is requested.
    score: session.status === "active" ? 0 : session.score,
    completedAt: session.completed_at,
    selectedRecords: selected.map((record) => ({
      recordId: record.gold_record_id,
      contentFingerprint: record.content_fingerprint,
      content: JSON.parse(record.content_json) as unknown,
    })),
    questions: questions.map((question) => ({
      ordinal: question.ordinal,
      goldRecordId: question.gold_record_id,
      goldContentFingerprint: question.gold_content_fingerprint,
      plannedDifficulty: question.planned_difficulty as 1 | 2 | 3,
      preparationStatus: question.preparation_status,
      answered: question.correct !== null,
    })),
  };
}

/** Reads one assessment only when it belongs to the authenticated learner. */
function findSessionForLearner(
  learnerId: string,
  sessionId: string,
): SessionRow | undefined {
  return learningDb
    .prepare(
      `SELECT ${SESSION_PROJECTION}
       FROM test_sessions WHERE id = ? AND learner_id = ?`,
    )
    .get(sessionId, learnerId) as SessionRow | undefined;
}

/** Reads the learner's resumable assessment for the start-time race recheck. */
function findActiveSessionForLearner(
  learnerId: string,
): SessionRow | undefined {
  return learningDb
    .prepare(
      `SELECT ${SESSION_PROJECTION}
       FROM test_sessions WHERE learner_id = ? AND status = 'active'`,
    )
    .get(learnerId) as SessionRow | undefined;
}

/** Reads the assessment to resume or the most recently finished assessment. */
function findLatestSessionForLearner(
  learnerId: string,
): SessionRow | undefined {
  return learningDb
    .prepare(
      `SELECT ${SESSION_PROJECTION}
       FROM test_sessions WHERE learner_id = ?
       ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, created_at DESC LIMIT 1`,
    )
    .get(learnerId) as SessionRow | undefined;
}

function loadSession(actor: AssessmentActor, sessionId: string): SessionRow {
  const session = findSessionForLearner(actor.learnerId, sessionId);
  if (!session) throw new Error("Assessment unavailable");
  return session;
}

function loadQuestions(sessionId: string): QuestionRow[] {
  return learningDb
    .prepare(
      `SELECT ordinal, gold_record_id, gold_content_fingerprint, planned_difficulty,
        preparation_status, preparation_lease_token, preparation_lease_until,
        question_payload_json, expected_answer, acceptable_answers_json, assignment_token,
        correct, points
       FROM test_questions WHERE test_session_id = ? ORDER BY ordinal`,
    )
    .all(sessionId) as QuestionRow[];
}

function stateFor(actor: AssessmentActor, sessionId: string): AssessmentState {
  return toState(loadSession(actor, sessionId), loadQuestions(sessionId));
}

/** Creates one learner-owned assessment or resumes that learner's active one. */
export function startAssessment(input: {
  readonly actor: AssessmentActor;
  readonly standardIds: readonly string[];
  readonly resolveRecords?: (ids: readonly string[]) => ResolvedGoldRecord[];
}): AssessmentState {
  assertLearner(input.actor);
  if (
    input.standardIds.length < 1 ||
    input.standardIds.length > 3 ||
    input.standardIds.some((id) => !id || !id.trim()) ||
    new Set(input.standardIds).size !== input.standardIds.length
  )
    throw new Error("Invalid selected Gold records");

  const existing = findActiveSessionForLearner(input.actor.learnerId);
  if (existing) return toState(existing, loadQuestions(existing.id));

  const records = (input.resolveRecords ?? resolveGoldRecordsForAssessment)(
    input.standardIds,
  );
  if (
    records.length !== input.standardIds.length ||
    records.some(
      (record, index) => record.recordId !== input.standardIds[index],
    ) ||
    records.some(
      (record) =>
        record.subject !== records[0]?.subject ||
        record.grade !== records[0]?.grade,
    )
  )
    throw new Error("Invalid selected Gold records");

  return withLearningTransaction(() => {
    // Repeat the active-session read after BEGIN IMMEDIATE to close the start race.
    const active = findActiveSessionForLearner(input.actor.learnerId);
    if (active) return toState(active, loadQuestions(active.id));

    const id = randomUUID();
    const createdAt = new Date().toISOString();
    learningDb
      .prepare(
        `INSERT INTO test_sessions
          (id, learner_id, subject, grade, status, score, created_at)
         VALUES (?, ?, ?, ?, 'active', 0, ?)`,
      )
      .run(
        id,
        input.actor.learnerId,
        records[0].subject,
        records[0].grade,
        createdAt,
      );

    const insertSelected = learningDb.prepare(
      `INSERT INTO test_selected_records
        (test_session_id, selection_ordinal, gold_record_id, subject, grade,
         content_json, content_fingerprint)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const [ordinal, record] of records.entries()) {
      insertSelected.run(
        id,
        ordinal + 1,
        record.recordId,
        record.subject,
        record.grade,
        record.contentJson,
        record.contentFingerprint,
      );
    }

    const insertQuestion = learningDb.prepare(
      `INSERT INTO test_questions
        (test_session_id, ordinal, gold_record_id, gold_content_fingerprint,
         planned_difficulty)
       VALUES (?, ?, ?, ?, ?)`,
    );
    for (const [index, difficulty] of DIFFICULTY_PLAN.entries()) {
      const record = records[index % records.length];
      insertQuestion.run(
        id,
        index + 1,
        record.recordId,
        record.contentFingerprint,
        difficulty,
      );
    }
    return stateFor(input.actor, id);
  });
}

/** Returns the latest learner-owned assessment for reload recovery. */
export function getLatestAssessmentState(input: {
  readonly actor: AssessmentActor;
}): AssessmentState | null {
  assertLearner(input.actor);
  const session = findLatestSessionForLearner(input.actor.learnerId);
  return session ? toState(session, loadQuestions(session.id)) : null;
}

/** Returns the learner's single resumable active assessment when present. */
export function getActiveAssessmentState(input: {
  readonly actor: AssessmentActor;
}): AssessmentState | null {
  assertLearner(input.actor);
  const session = findActiveSessionForLearner(input.actor.learnerId);
  return session ? toState(session, loadQuestions(session.id)) : null;
}

/** Returns the learner-scoped assessment state without answer keys or grading data. */
export function getAssessmentState(input: {
  readonly actor: AssessmentActor;
  readonly assessmentId: string;
}): AssessmentState {
  assertLearner(input.actor);
  return stateFor(input.actor, input.assessmentId);
}

/** Returns terminal review data without ever returning learner answer text. */
export function getAssessmentResult(input: {
  readonly actor: AssessmentActor;
  readonly assessmentId: string;
}): AssessmentResult {
  assertLearner(input.actor);
  const session = loadSession(input.actor, input.assessmentId);
  if (!isTerminalStatus(session.status))
    throw new Error("Assessment incomplete");
  const questions = learningDb
    .prepare(
      `SELECT ordinal, question_payload_json, expected_answer, correct, points
       FROM test_questions
       WHERE test_session_id = ? AND graded_at IS NOT NULL
       ORDER BY ordinal`,
    )
    .all(session.id) as Array<{
    ordinal: number;
    question_payload_json: string | null;
    expected_answer: string | null;
    correct: number | null;
    points: number | null;
  }>;
  if (
    (session.status === "completed" &&
      questions.length !== DIFFICULTY_PLAN.length) ||
    questions.some(
      (question) =>
        !question.question_payload_json ||
        !question.expected_answer ||
        question.correct === null ||
        question.points === null,
    )
  )
    throw new Error("Assessment result unavailable");
  return {
    id: session.id,
    subject: session.subject,
    grade: session.grade,
    status: session.status,
    score: session.score,
    completedAt: session.completed_at!,
    questions: questions.map((question) => ({
      ordinal: question.ordinal,
      question: JSON.parse(question.question_payload_json!),
      correct: question.correct === 1,
      points: question.points!,
      correctAnswer: question.expected_answer!,
    })),
  };
}

/** Marks the learner-owned active assessment partial without changing practice mastery. */
export function exitAssessment(input: {
  readonly actor: AssessmentActor;
  readonly assessmentId: string;
  /** Injectable clock for deterministic terminal timestamp checks. */
  readonly now?: Date;
}): AssessmentState {
  assertLearner(input.actor);
  return withLearningTransaction(() => {
    const session = loadSession(input.actor, input.assessmentId);
    if (session.status !== "active") return stateFor(input.actor, session.id);
    const exitedAt = (input.now ?? new Date()).toISOString();
    learningDb
      .prepare(
        `UPDATE test_sessions
         SET status = 'partial', completed_at = ?
         WHERE id = ? AND learner_id = ? AND status = 'active'`,
      )
      .run(exitedAt, session.id, input.actor.learnerId);
    return stateFor(input.actor, session.id);
  });
}

/**
 * Claims the active ungraded assignment for preparation. Only the claimant can
 * finalize it before the short lease expires; ready assignments are never replaced.
 */
export function claimAssessmentQuestionPreparation(input: {
  readonly actor: AssessmentActor;
  readonly assessmentId: string;
  readonly now?: number;
}):
  | {
      readonly status: "claimed";
      readonly ordinal: number;
      readonly leaseToken: string;
    }
  | {
      readonly status: "preparing" | "ready" | "unavailable";
      readonly ordinal: number;
    }
  | { readonly status: "finished" } {
  assertLearner(input.actor);
  return withLearningTransaction(() => {
    const session = loadSession(input.actor, input.assessmentId);
    if (session.status !== "active") return { status: "finished" };
    const question = learningDb
      .prepare(
        `SELECT ordinal, preparation_status, preparation_lease_until
         FROM test_questions
         WHERE test_session_id = ? AND graded_at IS NULL
         ORDER BY ordinal LIMIT 1`,
      )
      .get(session.id) as
      | {
          ordinal: number;
          preparation_status: "pending" | "preparing" | "ready" | "unavailable";
          preparation_lease_until: number | null;
        }
      | undefined;
    if (!question) return { status: "finished" };
    if (question.preparation_status === "ready")
      return { status: "ready", ordinal: question.ordinal };
    const now = input.now ?? Date.now();
    if (
      question.preparation_status === "preparing" &&
      question.preparation_lease_until !== null &&
      question.preparation_lease_until > now
    )
      return { status: "preparing", ordinal: question.ordinal };

    const leaseToken = randomUUID();
    const result = learningDb
      .prepare(
        `UPDATE test_questions
         SET preparation_status = 'preparing', preparation_lease_token = ?,
             preparation_lease_until = ?
         WHERE test_session_id = ? AND ordinal = ? AND graded_at IS NULL
           AND (preparation_status IN ('pending', 'unavailable')
             OR (preparation_status = 'preparing' AND preparation_lease_until <= ?))`,
      )
      .run(
        leaseToken,
        now + PREPARATION_LEASE_MS,
        session.id,
        question.ordinal,
        now,
      );
    if ((result.changes as number) !== 1)
      return { status: "preparing", ordinal: question.ordinal };
    return { status: "claimed", ordinal: question.ordinal, leaseToken };
  });
}

/** Retains a prepared question only when its current preparation lease owns it. */
export function finalizeAssessmentQuestion(input: {
  readonly actor: AssessmentActor;
  readonly assessmentId: string;
  readonly ordinal: number;
  readonly leaseToken: string;
  readonly question: AssessmentQuestionPayload;
  /** Injectable clock for deterministic lease-expiry checks. */
  readonly now?: number;
}): AssessmentState {
  assertLearner(input.actor);
  if (
    !Number.isInteger(input.ordinal) ||
    input.ordinal < 1 ||
    input.ordinal > DIFFICULTY_PLAN.length ||
    !input.leaseToken ||
    !input.question.question.trim() ||
    input.question.question.length > 400 ||
    !input.question.answer.trim() ||
    input.question.answer.length > 100 ||
    (input.question.acceptableAnswers?.some(
      (answer) => !answer.trim() || answer.length > 100,
    ) ??
      false)
  )
    throw new Error("Invalid assessment question");
  if (input.question.diagramSvg)
    validateLearningPayload({
      component: "GeometryDiagram",
      diagramSvg: input.question.diagramSvg,
    });

  return withLearningTransaction(() => {
    const session = loadSession(input.actor, input.assessmentId);
    if (session.status !== "active") throw new Error("Assessment completed");
    const {
      answer,
      acceptableAnswers = [],
      ...displayPayload
    } = input.question;
    const now = input.now ?? Date.now();
    const textHash = createHash("sha256")
      .update(input.question.question)
      .digest("hex");
    const result = learningDb
      .prepare(
        `UPDATE test_questions
         SET preparation_status = 'ready', preparation_lease_token = NULL,
             preparation_lease_until = NULL, question_payload_json = ?,
             expected_answer = ?, acceptable_answers_json = ?, assignment_token = ?,
             generator_content_version = 'adaptive-pool-v1',
             validation_schema_version = 'learning-payload-v1',
             validation_outcome = 'accepted', question_text_hash = ?
         WHERE test_session_id = ? AND ordinal = ? AND graded_at IS NULL
           AND preparation_status = 'preparing' AND preparation_lease_token = ?
           AND preparation_lease_until > ?`,
      )
      .run(
        JSON.stringify(displayPayload),
        answer,
        JSON.stringify(acceptableAnswers),
        randomUUID(),
        textHash,
        session.id,
        input.ordinal,
        input.leaseToken,
        now,
      );
    if ((result.changes as number) !== 1)
      throw new Error("Assessment preparation unavailable");
    return stateFor(input.actor, session.id);
  });
}

/** Makes a failed preparation visible while allowing the same ordinal to be retried. */
export function markAssessmentQuestionUnavailable(input: {
  readonly actor: AssessmentActor;
  readonly assessmentId: string;
  readonly ordinal: number;
  readonly leaseToken: string;
}): AssessmentState {
  assertLearner(input.actor);
  return withLearningTransaction(() => {
    const session = loadSession(input.actor, input.assessmentId);
    if (session.status !== "active") return stateFor(input.actor, session.id);
    learningDb
      .prepare(
        `UPDATE test_questions
         SET preparation_status = 'unavailable', preparation_lease_token = NULL,
             preparation_lease_until = NULL
         WHERE test_session_id = ? AND ordinal = ? AND graded_at IS NULL
           AND preparation_status = 'preparing' AND preparation_lease_token = ?`,
      )
      .run(session.id, input.ordinal, input.leaseToken);
    return stateFor(input.actor, session.id);
  });
}

/** Returns the active ready question with its opaque server-issued assignment token. */
export function getAssessmentQuestionForDisplay(input: {
  readonly actor: AssessmentActor;
  readonly assessmentId: string;
}): {
  readonly ordinal: number;
  readonly total: number;
  readonly question: unknown;
  readonly interaction: LearnerQuestionInteraction;
  readonly assignmentToken: string;
  readonly diagramSvg?: string;
} | null {
  assertLearner(input.actor);
  return withLearningTransaction(() => {
    const session = loadSession(input.actor, input.assessmentId);
    if (session.status !== "active") return null;
    const row = learningDb
      .prepare(
        `SELECT ordinal, question_payload_json, assignment_token FROM test_questions
         WHERE test_session_id = ? AND graded_at IS NULL AND preparation_status = 'ready'
         ORDER BY ordinal LIMIT 1`,
      )
      .get(session.id) as
      | {
          ordinal: number;
          question_payload_json: string;
          assignment_token: string | null;
        }
      | undefined;
    if (!row) return null;
    // Legacy retained questions were finalized before assignment tokens existed.
    // Bind one once under this transaction before ever displaying it again.
    const assignmentToken = row.assignment_token ?? randomUUID();
    if (!row.assignment_token) {
      const binding = learningDb
        .prepare(
          `UPDATE test_questions SET assignment_token = ?
           WHERE test_session_id = ? AND ordinal = ? AND assignment_token IS NULL
             AND graded_at IS NULL AND preparation_status = 'ready'`,
        )
        .run(assignmentToken, session.id, row.ordinal);
      if ((binding.changes as number) !== 1)
        throw new Error("Assessment question unavailable");
    }
    const payload = JSON.parse(row.question_payload_json) as {
      question?: unknown;
      interaction?: unknown;
      diagramSvg?: unknown;
    };
    if (typeof payload.question !== "string")
      throw new Error("Assessment question unavailable");
    const interaction = learnerQuestionInteractionSchema.parse(
      payload.interaction ?? textResponseInteraction(payload.question),
    );
    if (interaction.prompt !== payload.question)
      throw new Error("Assessment question unavailable");
    return {
      ordinal: row.ordinal,
      total: DIFFICULTY_PLAN.length,
      question: payload.question,
      interaction,
      assignmentToken,
      ...(typeof payload.diagramSvg === "string"
        ? { diagramSvg: payload.diagramSvg }
        : {}),
    };
  });
}

/** Supplies the reviewed snapshot needed only by the server-side generator. */
export function getAssessmentPreparationInput(input: {
  readonly actor: AssessmentActor;
  readonly assessmentId: string;
  readonly ordinal: number;
  readonly leaseToken: string;
  /** Injectable clock for deterministic lease-expiry checks. */
  readonly now?: number;
}): {
  readonly standardCode: string;
  readonly standardText: string;
  readonly difficulty: 1 | 2 | 3;
} {
  assertLearner(input.actor);
  const session = loadSession(input.actor, input.assessmentId);
  const now = input.now ?? Date.now();
  const row = learningDb
    .prepare(
      `SELECT q.planned_difficulty, q.preparation_lease_token, r.content_json
     FROM test_questions q JOIN test_selected_records r
       ON r.test_session_id = q.test_session_id AND r.gold_record_id = q.gold_record_id
     WHERE q.test_session_id = ? AND q.ordinal = ? AND q.preparation_status = 'preparing'
       AND q.preparation_lease_until > ?`,
    )
    .get(session.id, input.ordinal, now) as
    | {
        planned_difficulty: number;
        preparation_lease_token: string;
        content_json: string;
      }
    | undefined;
  if (!row || row.preparation_lease_token !== input.leaseToken)
    throw new Error("Assessment preparation unavailable");
  const content = JSON.parse(row.content_json) as {
    standardCode?: unknown;
    standardText?: unknown;
  };
  if (
    typeof content.standardCode !== "string" ||
    typeof content.standardText !== "string"
  )
    throw new Error("Assessment preparation unavailable");
  return {
    standardCode: content.standardCode,
    standardText: content.standardText,
    difficulty: row.planned_difficulty as 1 | 2 | 3,
  };
}

/** Grades only the token-bound retained question and never stores a learner answer. */
export function submitAssessmentAnswer(input: {
  readonly actor: AssessmentActor;
  readonly assessmentId: string;
  readonly answer: string;
  readonly assignmentToken: string;
}): AssessmentState {
  assertLearner(input.actor);
  const answer = input.answer.trim();
  if (
    !answer ||
    answer.length > 100 ||
    !input.assignmentToken ||
    input.assignmentToken.length > 100
  )
    throw new Error("Invalid assessment answer");
  const answerHash = createHash("sha256").update(answer).digest("hex");

  return withLearningTransaction(() => {
    const session = loadSession(input.actor, input.assessmentId);
    if (session.status !== "active") return stateFor(input.actor, session.id);
    const binding = learningDb
      .prepare(
        `SELECT ordinal, graded_at FROM test_questions
         WHERE test_session_id = ? AND assignment_token = ?`,
      )
      .get(session.id, input.assignmentToken) as
      | { ordinal: number; graded_at: string | null }
      | undefined;
    if (!binding) throw new Error("Assessment question unavailable");
    // A replay can arrive after the following question has become ready. The
    // durable token identifies the already graded assignment, so it is a safe
    // no-op instead of being applied to whichever question is currently ready.
    if (binding.graded_at !== null) return stateFor(input.actor, session.id);

    const current = learningDb
      .prepare(
        `SELECT ordinal, planned_difficulty, preparation_status, expected_answer,
          acceptable_answers_json, assignment_token FROM test_questions
         WHERE test_session_id = ? AND graded_at IS NULL
         ORDER BY ordinal LIMIT 1`,
      )
      .get(session.id) as
      | {
          ordinal: number;
          planned_difficulty: number;
          preparation_status: string;
          expected_answer: string | null;
          acceptable_answers_json: string | null;
          assignment_token: string | null;
        }
      | undefined;
    if (
      !current ||
      current.ordinal !== binding.ordinal ||
      current.assignment_token !== input.assignmentToken ||
      current.preparation_status !== "ready" ||
      !current.expected_answer
    )
      throw new Error("Assessment question unavailable");
    const acceptable = current.acceptable_answers_json
      ? (JSON.parse(current.acceptable_answers_json) as string[])
      : [];
    const correct = checkAnswer(answer, current.expected_answer, acceptable);
    const points = correct ? current.planned_difficulty * 10 : 0;
    const gradedAt = new Date().toISOString();
    const graded = learningDb
      .prepare(
        `UPDATE test_questions SET correct = ?, points = ?, graded_at = ?
         WHERE test_session_id = ? AND ordinal = ? AND assignment_token = ?
           AND graded_at IS NULL`,
      )
      .run(
        correct ? 1 : 0,
        points,
        gradedAt,
        session.id,
        current.ordinal,
        input.assignmentToken,
      );
    if ((graded.changes as number) !== 1)
      return stateFor(input.actor, session.id);

    const remaining = learningDb
      .prepare(
        "SELECT COUNT(*) AS count FROM test_questions WHERE test_session_id = ? AND graded_at IS NULL",
      )
      .get(session.id) as { count: number };
    learningDb
      .prepare(
        `UPDATE test_sessions
         SET score = score + ?, last_submission_hash = ?, last_submission_ordinal = ?,
             status = CASE WHEN ? = 0 THEN 'completed' ELSE status END,
             completed_at = CASE WHEN ? = 0 THEN ? ELSE completed_at END
         WHERE id = ? AND status = 'active'`,
      )
      .run(
        points,
        answerHash,
        current.ordinal,
        remaining.count,
        remaining.count,
        gradedAt,
        session.id,
      );
    return stateFor(input.actor, session.id);
  });
}
