import { requireLearnerMutationProof } from "../../../server/identity/identity";
import { submitPracticeAssignment } from "../../../server/learning/learning";

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
    candidate.topicId.length > 300 ||
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

    const { nextPracticeDifficulty: _nextPracticeDifficulty, ...response } =
      result;
    return Response.json(
      {
        ...response,
        points: result.correct
          ? result.answeredDifficulty === 1
            ? 10
            : result.answeredDifficulty === 2
              ? 20
              : 30
          : 0,
        nextQuestion: null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    // Do not disclose whether a token was stale, fabricated, or already used.
    return Response.json(
      { error: "Unable to save answer" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
