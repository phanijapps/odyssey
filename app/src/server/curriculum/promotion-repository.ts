import "server-only";
import { DatabaseSync } from "node:sqlite";
import {
  approveBronze,
  approveSilver,
  ingestGold,
  ingestSilver,
  type CurriculumPromotion,
} from "../../../../packages/curriculum/src/promotion-workflow";

const database = new DatabaseSync(
  process.env.ODYSSEY_CURRICULUM_DB_PATH ?? ":memory:",
);
database.exec(`CREATE TABLE IF NOT EXISTS curriculum_promotions (
  id TEXT PRIMARY KEY, stage TEXT NOT NULL, source_id TEXT NOT NULL, updated_at TEXT NOT NULL
);`);

/** Persists application-owned promotion transitions for desktop stewardship. */
export function createBronzePromotion(
  id: string,
  sourceId: string,
): CurriculumPromotion {
  if (!id || !sourceId) throw new Error("Invalid curriculum promotion");
  database
    .prepare(
      "INSERT INTO curriculum_promotions(id, stage, source_id, updated_at) VALUES (?, ?, ?, ?)",
    )
    .run(id, "bronze", sourceId, new Date().toISOString());
  return { id, stage: "bronze" };
}

export function advancePromotion(
  id: string,
  action: "approve-bronze" | "ingest-silver" | "approve-silver" | "ingest-gold",
): CurriculumPromotion {
  const row = database
    .prepare("SELECT stage FROM curriculum_promotions WHERE id = ?")
    .get(id) as { stage?: CurriculumPromotion["stage"] } | undefined;
  if (!row?.stage) throw new Error("Unknown curriculum promotion");
  const current: CurriculumPromotion = { id, stage: row.stage };
  const next =
    action === "approve-bronze"
      ? approveBronze(current)
      : action === "ingest-silver"
        ? ingestSilver(current)
        : action === "approve-silver"
          ? approveSilver(current)
          : ingestGold(current);
  database
    .prepare(
      "UPDATE curriculum_promotions SET stage = ?, updated_at = ? WHERE id = ?",
    )
    .run(next.stage, new Date().toISOString(), id);
  return next;
}
