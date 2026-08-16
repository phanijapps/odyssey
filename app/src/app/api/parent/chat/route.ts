import { resolveSession } from "../../../../server/identity/identity";
import { getParentProgressSummary } from "../../../../server/learning/learning";
import { getSeedCurriculumCatalog } from "../../../../server/curriculum/catalog";

/** Builds a natural-language reply from the child's structured progress data. */
function buildReply(
  message: string,
  summary: ReturnType<typeof getParentProgressSummary>,
): string {
  const catalog = getSeedCurriculumCatalog();
  const titleFor = (topicId: string) =>
    catalog.topics.find((t) => t.id === topicId)?.title ?? topicId;
  const lower = message.toLowerCase();

  if (summary.totalAttempts === 0)
    return "No practice activity has been recorded yet. Practice will appear here once your child starts answering questions.";

  // Accuracy question
  if (/\baccuracy|how (well|good)|doing\b/.test(lower)) {
    return `Overall accuracy is ${summary.overallAccuracy}% (${summary.totalCorrect} correct out of ${summary.totalAttempts} attempts).`;
  }

  // Weak areas question
  if (/\bstruggl|weak|difficult|hard|help|worst|need\b/.test(lower)) {
    const sorted = [...summary.topics].sort((a, b) => a.accuracy - b.accuracy);
    const weakest = sorted[0];
    if (weakest && weakest.attempts > 0)
      return `The area that needs the most attention is "${titleFor(weakest.topicId)}" with ${weakest.accuracy}% accuracy (${weakest.correct} correct out of ${weakest.attempts} attempts).`;
  }

  // Best/strong areas question
  if (/\bbest|strong|good at|excell\b/.test(lower)) {
    const sorted = [...summary.topics].sort((a, b) => b.accuracy - a.accuracy);
    const best = sorted[0];
    if (best && best.attempts > 0)
      return `The strongest area is "${titleFor(best.topicId)}" with ${best.accuracy}% accuracy at level ${best.level}.`;
  }

  // Specific topic question
  for (const topic of summary.topics) {
    const title = titleFor(topic.topicId).toLowerCase();
    if (topic.attempts > 0 && lower.includes(topic.topicId.toLowerCase()))
      return `"${titleFor(topic.topicId)}": ${topic.attempts} attempts, ${topic.accuracy}% accuracy, currently at level ${topic.level}.`;
  }

  // Recent activity question
  if (/\brecent|last|lately|today\b/.test(lower)) {
    const recent = summary.recentAttempts.slice(0, 5);
    if (recent.length > 0) {
      const lines = recent.map(
        (a) =>
          `  - ${a.correct ? "Correct" : "Incorrect"} on "${titleFor(a.topicId)}" (level ${a.levelAfter})`,
      );
      return `Here are the ${recent.length} most recent attempts:\n${lines.join("\n")}`;
    }
  }

  // Level/progress question
  if (/\blevel|progress|advanc\b/.test(lower)) {
    const lines = summary.topics.map(
      (t) =>
        `  - "${titleFor(t.topicId)}": level ${t.level}, ${t.accuracy}% accuracy`,
    );
    return `Current progress by topic:\n${lines.join("\n")}`;
  }

  // Default: overview
  const lines = summary.topics.map(
    (t) =>
      `  - "${titleFor(t.topicId)}": ${t.attempts} attempts, ${t.accuracy}% accuracy, level ${t.level}`,
  );
  return `${summary.totalAttempts} total attempts across ${summary.topics.length} topic${summary.topics.length === 1 ? "" : "s"} with ${summary.overallAccuracy}% overall accuracy.\n${lines.join("\n")}`;
}

export async function POST(request: Request): Promise<Response> {
  const token = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)session=([^;]+)/)?.[1];
  const session = token ? resolveSession(token) : undefined;
  if (!session)
    return Response.json({ error: "Sign-in required" }, { status: 401 });
  try {
    const body = (await request.json()) as { message?: unknown };
    if (
      typeof body.message !== "string" ||
      body.message.trim().length < 1 ||
      body.message.length > 500
    )
      return Response.json({ error: "Message is invalid" }, { status: 400 });
    const summary = getParentProgressSummary(session.childId);
    return Response.json({ reply: buildReply(body.message, summary) });
  } catch {
    return Response.json(
      { error: "Unable to answer that message" },
      { status: 400 },
    );
  }
}
