import {
  learnerScopeKeyForUsername,
  listParentChildren,
  requireParentRead,
} from "../../../../server/identity/identity";
import { getParentPracticePreview } from "../../../../server/learning/parent-preview";

/** Returns one non-mutating reviewed Practice preview for a linked child. */
export function GET(request: Request): Response {
  let parentAccountId: string;
  try {
    ({ parentAccountId } = requireParentRead(request));
  } catch (error) {
    const status =
      error instanceof Error && error.message === "Parent access required"
        ? 403
        : 401;
    return Response.json(
      { error: status === 403 ? "Parent access required" : "Sign-in required" },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    return Response.json(
      {
        preview: getParentPracticePreview(
          listParentChildren(parentAccountId).map((child) => ({
            scopeKey: learnerScopeKeyForUsername(child.username),
            username: child.username,
          })),
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Practice preview is unavailable" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
