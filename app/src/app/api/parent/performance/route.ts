import {
  listParentChildren,
  requireParentRead,
} from "../../../../server/identity/identity";
import { getParentSafePerformance } from "../../../../server/learning/parent-performance";

/** Returns aggregate Performance only for children with the parent's active links. */
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
    const children = listParentChildren(parentAccountId).map((child) => ({
      username: child.username,
      performance: getParentSafePerformance(child.accountId),
    }));
    return Response.json(
      { children },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Performance is unavailable" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
