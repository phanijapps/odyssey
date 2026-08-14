import "server-only";
import { requireAdmin } from "../../../server/identity/identity";
import {
  seedCurriculumGraph,
  graphStats,
  listGraphContent,
} from "../../../server/memory/knowledge-graph";
import { searchKnowledgeGraph } from "../../../server/memory/knowledge-graph-search";

/** Returns knowledge-graph stats, or searches with ?q=. */
export function GET(request: Request): Response {
  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  const childId = url.searchParams.get("childId") ?? "child-1";
  if (query !== null) {
    return Response.json(searchKnowledgeGraph({ query, childId }));
  }
  return Response.json({ ...graphStats(), ...listGraphContent() });
}

/** Seeds the curriculum knowledge graph from Gold records. */
export function POST(request: Request): Response {
  try {
    requireAdmin(request);
  } catch {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }
  const result = seedCurriculumGraph();
  return Response.json({ ...result, ...graphStats() });
}
