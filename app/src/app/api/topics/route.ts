import { getSeedCurriculumCatalog } from "../../../server/curriculum/catalog";

export function GET(): Response {
  return Response.json(getSeedCurriculumCatalog().topics);
}
