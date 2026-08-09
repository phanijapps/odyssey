import {
  grantGeneratedPracticeAllowance,
  requireMutationProof,
} from "../../../server/identity/identity";
import { submitAnswer } from "../../../server/learning/learning";
import { requestLearningFixture } from "../../../server/agent/agent";
import { getSeedCurriculumCatalog } from "../../../../../packages/curriculum/src/catalog";
import { validateLearningPayload } from "../../../server/validation/payloads";
import {
  projectLearningSignal,
  recallLearningContext,
  writeLearningSignal,
} from "../../../server/memory/engram-memory";

export async function POST(request: Request): Promise<Response> {
  try {
    const { childId } = requireMutationProof(request);
    const body = await request.json();
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      !Object.keys(body).every(
        (key) => key === "topicId" || key === "answer",
      ) ||
      typeof body.topicId !== "string" ||
      typeof body.answer !== "string" ||
      body.topicId.length === 0 ||
      body.topicId.length > 100 ||
      body.answer.length === 0 ||
      body.answer.length > 100
    )
      throw new Error("Invalid answer submission");
    if (
      !getSeedCurriculumCatalog().topics.some(
        (topic) => topic.id === body.topicId,
      )
    )
      throw new Error("Unknown topic");
    const result = await submitAnswer({
      childId,
      topicId: body.topicId,
      answer: body.answer,
      nextLevel: 1,
    });
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
    const nextQuestion = await requestLearningFixture({
      childId,
      topicId: body.topicId,
      level: result.level,
      attemptCount: result.attemptCount,
    });
    validateLearningPayload({
      component: "GeometryDiagram",
      diagramSvg: nextQuestion.diagramSvg,
    });
    grantGeneratedPracticeAllowance(request, body.topicId);
    return Response.json({
      ...result,
      memoryWritten,
      memoryRecalled,
      nextQuestion,
    });
  } catch {
    return Response.json({ error: "Unable to save answer" }, { status: 400 });
  }
}
