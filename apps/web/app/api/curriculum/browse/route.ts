import { getBrowseTree } from "@odyssey/db";

/** Returns the browseable curriculum tree: subjects → grades → domains → standards. */
export function GET(): Response {
  return Response.json(getBrowseTree());
}
