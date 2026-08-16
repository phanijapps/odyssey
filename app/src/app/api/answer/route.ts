import {
  appendSessionPoolQuestion,
  grantGeneratedPracticeAllowance,
  requireLearnerMutationProof,
} from "../../../server/identity/identity";
import {
  getTopicDetail,
  submitPracticeAssignment,
} from "../../../server/learning/learning";
import { prefetchNextQuestion } from "../../../server/agent/adaptive-pool";
import {
  projectLearningSignal,
  recallLearningContext,
  writeLearningSignal,
} from "../../../server/memory/engram-memory";
import { getStandardsForSelection } from "../../../server/curriculum/browse";
import {
  recordLearningAttempt,
  putMasteryBelief,
} from "../../../server/memory/knowledge-graph";

type AnswerSubmission = {
  topicId: string;
  answer: string;
  assignmentToken: string;
};

/** Parses the only accepted public Practice answer DTO. */
function parseAnswerSubmission(body: unknown): AnswerSubmission {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    !Object.keys(body).every(
      (key) =>
        key === "topicId" || key === "answer" || key === "assignmentToken",
    )
  )
    throw new Error("Invalid answer submission");
  const candidate = body as Record<string, unknown>;
  if (
    typeof candidate.topicId !== "string" ||
    candidate.topicId.length === 0 ||
    candidate.topicId.length > 100 ||
    typeof candidate.answer !== "string" ||
    candidate.answer.length === 0 ||
    candidate.answer.length > 100 ||
    typeof candidate.assignmentToken !== "string" ||
    !/^[A-Za-z0-9_-]{32,}$/.test(candidate.assignmentToken)
  )
    throw new Error("Invalid answer submission");
  return {
    topicId: candidate.topicId,
    answer: candidate.answer,
    assignmentToken: candidate.assignmentToken,
  };
}

/** Consumes exactly one server-issued Practice assignment. */
export async function POST(request: Request): Promise<Response> {
  try {
    const { childId, sessionTokenHash } = requireLearnerMutationProof(request);
    const body = parseAnswerSubmission(await request.json());
    const result = submitPracticeAssignment({
      childId,
      sessionTokenHash,
      topicId: body.topicId,
      answer: body.answer,
      assignmentToken: body.assignmentToken,
    });

    const [subject = "", grade = "", domain = "", standardCode = ""] =
      body.topicId.split("::");
    const standards = getStandardsForSelection({ subject, grade, domain });
    const matchedStandard = standards.find(
      (standard) => standard.standardCode === standardCode,
    );
    if (matchedStandard) {
      recordLearningAttempt({
        childId,
        standardId: matchedStandard.standardCode,
        standardCode: matchedStandard.standardCode,
        correct: result.correct,
        difficulty: result.answeredDifficulty,
        topicId: body.topicId,
      });
      const detail = getTopicDetail(childId, body.topicId);
      if (detail && detail.attempts > 0)
        putMasteryBelief({
          childId,
          standardId: matchedStandard.standardCode,
          standardCode: matchedStandard.standardCode,
          correctRate: detail.correct / detail.attempts,
          attempts: detail.attempts,
        });
    }

    const memoryWritten = await writeLearningSignal(
      childId,
      projectLearningSignal({
        topicId: body.topicId,
        acceptedLevel: result.level,
        correct: result.correct,
        progressState: result.level >= 5 ? "proficient" : "practicing",
      }),
    );
    const memoryRecalled = await recallLearningContext(childId);

    // The durable transaction has already cleared the old assignment and
    // persisted this difficulty before a best-effort next-question prefetch.
    prefetchNextQuestion(
      body.topicId,
      result.nextPracticeDifficulty,
      standardCode
        ? standards.filter((standard) => standard.standardCode === standardCode)
        : standards,
      (next) => appendSessionPoolQuestion(request, next),
    );
    grantGeneratedPracticeAllowance(request, body.topicId);

    const { nextPracticeDifficulty: _nextPracticeDifficulty, ...response } =
      result;
    return Response.json({
      ...response,
      points: result.correct
        ? result.answeredDifficulty === 1
          ? 10
          : result.answeredDifficulty === 2
            ? 20
            : 30
        : 0,
      memoryWritten,
      memoryRecalled,
      nextQuestion: null,
    });
  } catch {
    // Do not disclose whether a token was stale, fabricated, or already used.
    return Response.json({ error: "Unable to save answer" }, { status: 400 });
  }
}
