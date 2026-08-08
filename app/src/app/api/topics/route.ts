import { getSeedCurriculumCatalog } from "../../../../../packages/curriculum/src/catalog";

export function GET(): Response {
  return Response.json(getSeedCurriculumCatalog().topics);
}
