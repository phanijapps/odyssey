import { resolveSession } from "../../../../server/identity/identity";
import { getParentProgressSummary } from "../../../../server/learning/learning";

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
    return Response.json({
      reply:
        summary.totalAttempts === 0
          ? "No practice activity has been recorded yet."
          : `Practice activity includes ${summary.totalAttempts} recorded attempt${summary.totalAttempts === 1 ? "" : "s"} across ${summary.topics.length} topic${summary.topics.length === 1 ? "" : "s"}.`,
    });
  } catch {
    return Response.json(
      { error: "Unable to answer that message" },
      { status: 400 },
    );
  }
}
