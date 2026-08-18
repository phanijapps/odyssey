import "server-only";
import { requireAdminRead } from "../../../../server/identity/identity";
import { graphSnapshot } from "../../../../server/memory/knowledge-graph";

/** Returns one bounded, kind-tagged graph snapshot for the 3D view. */
export function GET(request: Request): Response {
  try {
    requireAdminRead(request);
  } catch {
    return Response.json(
      { error: "Admin access required" },
      {
        status: 403,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
  return Response.json(graphSnapshot(), {
    headers: { "Cache-Control": "no-store" },
  });
}
