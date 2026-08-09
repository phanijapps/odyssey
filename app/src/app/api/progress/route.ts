import { getSeedCurriculumCatalog } from "../../../../../packages/curriculum/src/catalog";
import { resolveSession } from "../../../server/identity/identity";
import { getLearningProgress } from "../../../server/learning/learning";
import { requestLearningFixture } from "../../../server/agent/agent";
import { validateLearningPayload } from "../../../server/validation/payloads";

/** Returns the signed-in child's persisted progress for one reviewed topic. */
export async function GET(request: Request): Promise<Response> {
  const token = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)session=([^;]+)/)?.[1];
  const session = token ? resolveSession(token) : undefined;
  if (!session)
    return Response.json({ error: "Sign-in required" }, { status: 401 });
  const topicId = new URL(request.url).searchParams.get("topicId");
  if (
    !topicId ||
    !getSeedCurriculumCatalog().topics.some((topic) => topic.id === topicId)
  )
    return Response.json({ error: "Unknown topic" }, { status: 400 });
  const progress = getLearningProgress(session.childId, topicId) ?? {
    level: 1,
    correctStreak: 0,
    attemptCount: 0,
  };
  const nextQuestion = await requestLearningFixture({
    childId: session.childId,
    topicId,
    level: progress.level,
    attemptCount: progress.attemptCount,
  });
  validateLearningPayload({
    component: "GeometryDiagram",
    diagramSvg: nextQuestion.diagramSvg,
  });
  return Response.json(
    { ...progress, nextQuestion },
    { headers: { "Cache-Control": "no-store" } },
  );
}
