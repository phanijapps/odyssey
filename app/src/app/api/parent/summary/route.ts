import { resolveSession } from "../../../../server/identity/identity";
import { getParentProgressSummary } from "../../../../server/learning/learning";
import { getSeedCurriculumCatalog } from "../../../../../../packages/curriculum/src/catalog";

/** Returns a rich parent-facing progress summary with accuracy and history. */
export function GET(request: Request): Response {
  const token = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)session=([^;]+)/)?.[1];
  const session = token ? resolveSession(token) : undefined;
  if (!session)
    return Response.json({ error: "Sign-in required" }, { status: 401 });
  const raw = getParentProgressSummary(session.childId);
  const catalog = getSeedCurriculumCatalog();
  const titleFor = (topicId: string) =>
    catalog.topics.find((t) => t.id === topicId)?.title ?? topicId;
  return Response.json({
    totalAttempts: raw.totalAttempts,
    totalCorrect: raw.totalCorrect,
    overallAccuracy: raw.overallAccuracy,
    topics: raw.topics.map((t) => ({
      ...t,
      title: titleFor(t.topicId),
    })),
    recentAttempts: raw.recentAttempts.map((a) => ({
      ...a,
      title: titleFor(a.topicId),
    })),
  });
}
