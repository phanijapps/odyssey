import "server-only";
import {
  learnerScopeKeyForUsername,
  listParentChildren,
  requireParentRead,
} from "../../../../../../server/identity/identity";
import { getParentSafePerformance } from "../../../../../../server/learning/parent-performance";

/** Exports one linked child's parent-safe progress as a downloadable JSON file. */
export async function GET(
  request: Request,
  context: { params: Promise<{ childId: string }> },
): Promise<Response> {
  let parentAccountId: string;
  try {
    ({ parentAccountId } = requireParentRead(request));
  } catch {
    return Response.json({ error: "Parent access required" }, { status: 403 });
  }
  const { childId } = await context.params;
  const linked = listParentChildren(parentAccountId).find(
    (child) => child.accountId === childId,
  );
  if (!linked)
    return Response.json({ error: "Child access denied" }, { status: 403 });

  const scope = learnerScopeKeyForUsername(linked.username);
  const exportedAt = new Date().toISOString();
  try {
    const performance = getParentSafePerformance(scope, new Date());
    return new Response(
      JSON.stringify(
        { username: linked.username, exportedAt, performance },
        null,
        2,
      ),
      {
        headers: {
          "content-type": "application/json",
          "content-disposition": `attachment; filename="odyssey-${linked.username}-progress.json"`,
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return Response.json({ error: "Export failed" }, { status: 500 });
  }
}
