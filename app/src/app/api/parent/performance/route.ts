import {
  learnerScopeKeyForUsername,
  listParentChildren,
  requireParentRead,
} from "../../../../server/identity/identity";
import { PARENT_PERFORMANCE_CHILD_CAP } from "../../../parent/performance-phrases";
import { getParentSafePerformance } from "../../../../server/learning/parent-performance";

/** Returns aggregate Performance only for children with the parent's active links. */
export function GET(request: Request, now?: unknown): Response {
  // Next.js passes its route context as the second argument in production;
  // tests pass a frozen Date. Only a real Date overrides evaluation time.
  const evaluatedAt = now instanceof Date ? now : new Date();
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
    const children = listParentChildren(parentAccountId).map((child) => ({
      username: child.username,
      performance: getParentSafePerformance(
        learnerScopeKeyForUsername(child.username),
        evaluatedAt,
      ),
    }));
    return Response.json(
      {
        // Aggregate projection of the same reviewed data, capped at the
        // portal's historical child cap.
        children: children.slice(0, PARENT_PERFORMANCE_CHILD_CAP),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Performance is unavailable" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
