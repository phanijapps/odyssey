import "server-only";
import { getTemporaryPromotionView } from "../../../../../server/curriculum/promotion-store";
import { requireAdminRead } from "../../../../../server/identity/identity";

type RouteContext = { params: Promise<{ ingestionId: string }> };

/** Reads the safe review view of one temporary curriculum workflow. */
export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  try {
    requireAdminRead(request);
  } catch {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }
  const { ingestionId } = await context.params;
  const workflow = getTemporaryPromotionView(ingestionId);
  if (!workflow)
    return Response.json(
      { error: "Curriculum workflow not found" },
      { status: 404 },
    );
  return Response.json(workflow);
}
