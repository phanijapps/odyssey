import "server-only";
import {
  approveBronze,
  approveSilver,
  ingestGold,
  ingestSilver,
  type CurriculumPromotion,
} from "../../../../packages/curriculum/src/promotion-workflow";
import type { CurriculumUpload } from "./source-importer";

type TemporaryCurriculumWorkflow = {
  readonly promotion: CurriculumPromotion;
  readonly bronze?: CurriculumUpload;
  readonly sourceBytes?: Uint8Array;
};

type TemporaryPromotionView = {
  readonly id: string;
  readonly stage: CurriculumPromotion["stage"];
  readonly bronze?: CurriculumUpload;
};

const promotions = new Map<string, TemporaryCurriculumWorkflow>();

/** Holds unapproved Bronze and Silver workflow state only for the local session. */
export function createBronzePromotion(id: string): CurriculumPromotion {
  if (!id || promotions.has(id))
    throw new Error("Invalid curriculum promotion");
  const promotion: CurriculumPromotion = { id, stage: "bronze" };
  promotions.set(id, { promotion });
  return promotion;
}

/** Creates a local-only Bronze workflow; raw bytes never leave this module. */
export function createTemporaryBronzePromotion(input: {
  readonly id: string;
  readonly upload: CurriculumUpload;
  readonly bytes: Uint8Array;
}): TemporaryCurriculumWorkflow {
  const promotion = createBronzePromotion(input.id);
  const workflow = {
    promotion,
    bronze: input.upload,
    sourceBytes: input.bytes,
  };
  promotions.set(input.id, workflow);
  return workflow;
}

/** Returns review metadata without exposing temporary source bytes. */
export function getTemporaryPromotionView(
  id: string,
): TemporaryPromotionView | undefined {
  const workflow = promotions.get(id);
  if (!workflow) return undefined;
  return {
    id: workflow.promotion.id,
    stage: workflow.promotion.stage,
    ...(workflow.bronze ? { bronze: workflow.bronze } : {}),
  };
}

/** Advances a temporary workflow; Gold callers receive the final handoff record. */
export function advancePromotion(
  id: string,
  action: "approve-bronze" | "ingest-silver" | "approve-silver" | "ingest-gold",
): CurriculumPromotion {
  const workflow = promotions.get(id);
  if (!workflow) throw new Error("Unknown curriculum promotion");
  const current = workflow.promotion;
  const next =
    action === "approve-bronze"
      ? approveBronze(current)
      : action === "ingest-silver"
        ? ingestSilver(current)
        : action === "approve-silver"
          ? approveSilver(current)
          : ingestGold(current);
  if (next.stage === "gold") promotions.delete(id);
  else promotions.set(id, { ...workflow, promotion: next });
  return next;
}

/** Discards an unfinished local workflow and all of its temporary artifacts. */
export function expireTemporaryPromotion(id: string): void {
  promotions.delete(id);
}
