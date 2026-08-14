import { getBrowseTree } from "../../../../server/curriculum/browse";

/** Returns the browseable curriculum tree: subjects → grades → domains → standards. */
export function GET(): Response {
  return Response.json(getBrowseTree());
}
