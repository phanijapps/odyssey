import "server-only";
import {
  approveBronze,
  approveSilver,
  ingestGold,
  ingestSilver,
  type CurriculumPromotion,
} from "../../../../packages/curriculum/src/promotion-workflow";

const promotions = new Map<string, CurriculumPromotion>();

/** Holds unapproved Bronze and Silver workflow state only for the local session. */
export function createBronzePromotion(id: string): CurriculumPromotion {
  if (!id || promotions.has(id))
    throw new Error("Invalid curriculum promotion");
  const promotion: CurriculumPromotion = { id, stage: "bronze" };
  promotions.set(id, promotion);
  return promotion;
}

/** Advances a temporary workflow; Gold callers receive the final handoff record. */
export function advancePromotion(
  id: string,
  action: "approve-bronze" | "ingest-silver" | "approve-silver" | "ingest-gold",
): CurriculumPromotion {
  const current = promotions.get(id);
  if (!current) throw new Error("Unknown curriculum promotion");
  const next =
    action === "approve-bronze"
      ? approveBronze(current)
      : action === "ingest-silver"
        ? ingestSilver(current)
        : action === "approve-silver"
          ? approveSilver(current)
          : ingestGold(current);
  if (next.stage === "gold") promotions.delete(id);
  else promotions.set(id, next);
  return next;
}
