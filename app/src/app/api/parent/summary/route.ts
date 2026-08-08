import { resolveSession } from "../../../../server/identity/identity";
import { getParentProgressSummary } from "../../../../server/learning/learning";

export function GET(request: Request): Response {
  const token = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)session=([^;]+)/)?.[1];
  const session = token ? resolveSession(token) : undefined;
  if (!session)
    return Response.json({ error: "Sign-in required" }, { status: 401 });
  return Response.json(getParentProgressSummary(session.childId));
}
