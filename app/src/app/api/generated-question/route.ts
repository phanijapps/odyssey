import "server-only";
import { requestOllamaLearningQuestion } from "../../../server/agent/agent";
import {
  consumeGeneratedPracticeAllowance,
  requireMutationProof,
} from "../../../server/identity/identity";
import { getLearningProgress } from "../../../server/learning/learning";
import { validateLearningPayload } from "../../../server/validation/payloads";
import { getSeedCurriculumCatalog } from "../../../../../packages/curriculum/src/catalog";

const unavailableResponse = () =>
  Response.json(
    {
      error:
        "Generated practice is unavailable. Your local practice question is still ready.",
    },
    { status: 503 },
  );

/** Requests one bounded provider-backed question for the signed-in child's topic. */
export async function POST(request: Request): Promise<Response> {
  let childId: string;
  let topicId: string;
  try {
    requireMutationProof(request);
    const body = await request.json();
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      !Object.keys(body).every((key) => key === "topicId") ||
      typeof body.topicId !== "string" ||
      body.topicId.length === 0 ||
      body.topicId.length > 100 ||
      !getSeedCurriculumCatalog().topics.some(
        (topic) => topic.id === body.topicId,
      )
    )
      throw new Error();
    topicId = body.topicId;
    ({ childId } = consumeGeneratedPracticeAllowance(request, topicId));
  } catch {
    return Response.json(
      { error: "Unable to request generated practice" },
      { status: 400 },
    );
  }
  try {
    const progress = getLearningProgress(childId, topicId);
    const question = await requestOllamaLearningQuestion({
      topicId,
      level: progress?.level ?? 1,
    });
    validateLearningPayload({
      component: "GeometryDiagram",
      diagramSvg: question.diagramSvg,
    });
    return Response.json(question);
  } catch {
    return unavailableResponse();
  }
}
