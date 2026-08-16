import { resolveSession } from "../../../server/identity/identity";
import { getLearnerHistory } from "../../../server/learning/learning";

/** Returns only the signed-in learner's redacted practice and test timeline. */
export function GET(request: Request): Response {
  const token = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)session=([^;]+)/)?.[1];
  const session = token ? resolveSession(token) : undefined;
  if (!session || session.role !== "student")
    return Response.json({ error: "Learner access required" }, { status: 401 });
  return Response.json(
    { entries: getLearnerHistory(session.childId) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
