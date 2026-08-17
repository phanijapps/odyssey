import "server-only";
import { requestOllamaLearningQuestion } from "../../../server/agent/agent";
import {
  consumeGeneratedPracticeAllowance,
  issueGeneratedPracticeAssignment,
  requireLearnerMutationProof,
} from "../../../server/identity/identity";
import { getLearningProgress } from "../../../server/learning/learning";
import { validateLearningPayload } from "../../../server/validation/payloads";
import { retrieveProfileMemory } from "../../../server/memory/engram-memory";

const unavailableResponse = () =>
  Response.json(
    {
      error:
        "Generated practice is unavailable. Your local practice question is still ready.",
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );

/** Requests one bounded provider-backed question for the signed-in child's topic. */
export async function POST(request: Request): Promise<Response> {
  let childId: string;
  let topicId: string;
  try {
    requireLearnerMutationProof(request);
    const body = await request.json();
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      !Object.keys(body).every((key) => key === "topicId") ||
      typeof body.topicId !== "string" ||
      body.topicId.length === 0 ||
      body.topicId.length > 100
    )
      throw new Error();
    topicId = body.topicId;
    ({ childId } = consumeGeneratedPracticeAllowance(request, topicId));
  } catch {
    return Response.json(
      { error: "Unable to request generated practice" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const progress = getLearningProgress(childId, topicId);
    const profileMemory = await retrieveProfileMemory({
      sessionChildId: childId,
      requestedChildId: childId,
    });
    const question = await requestOllamaLearningQuestion({
      topicId,
      level: progress?.level ?? 1,
      profileContext: profileMemory.at(-1),
    });
    validateLearningPayload({
      component: "GeometryDiagram",
      diagramSvg: question.diagramSvg,
    });
    const assignment = issueGeneratedPracticeAssignment(request, {
      topicId,
      question: question.question,
      answer: question.answer,
      acceptableAnswers: question.acceptableAnswers,
      hint: question.hint,
      solution: question.solution,
      diagramSvg: question.diagramSvg,
    });
    if (!assignment) throw new Error("Practice assignment unavailable");
    return Response.json(
      {
        question: question.question,
        diagramSvg: question.diagramSvg,
        assignmentToken: assignment.assignmentToken,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return unavailableResponse();
  }
}
