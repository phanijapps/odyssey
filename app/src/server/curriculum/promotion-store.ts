import "server-only";
import {
  approveBronze,
  approveSilver,
  ingestGold,
  ingestSilver,
  type CurriculumPromotion,
} from "../../../../packages/curriculum/src/promotion-workflow";
import type { CurriculumUpload } from "./source-importer";
import type { SilverCandidate } from "./curriculum-pi-agent";
import type { GoldCandidate } from "./curriculum-pi-agent";

type TemporaryCurriculumWorkflow = {
  readonly promotion: CurriculumPromotion;
  readonly bronze?: CurriculumUpload;
  readonly sourceBytes?: Uint8Array;
  readonly silver?: SilverCandidate;
  readonly gold?: GoldCandidate;
};

export type TemporaryPromotionView = {
  readonly id: string;
  readonly stage: CurriculumPromotion["stage"];
  readonly bronze?: CurriculumUpload;
  readonly silver?: SilverCandidate;
  readonly gold?: GoldCandidate;
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
    ...(workflow.silver ? { silver: workflow.silver } : {}),
    ...(workflow.gold ? { gold: workflow.gold } : {}),
  };
}

/** Returns approved Bronze data for the server-only Silver transformation. */
export function getApprovedBronzeForSilver(id: string): {
  readonly source: string;
  readonly sourceFingerprint: string;
  readonly format: CurriculumUpload["format"];
} {
  const workflow = promotions.get(id);
  if (
    !workflow?.bronze ||
    !workflow.sourceBytes ||
    workflow.promotion.stage !== "bronze-approved"
  )
    throw new Error("Bronze approval required");
  return {
    source: new TextDecoder().decode(workflow.sourceBytes),
    sourceFingerprint: workflow.bronze.fingerprint,
    format: workflow.bronze.format,
  };
}

/** Saves a schema-validated Silver candidate only in the temporary workflow. */
export function saveSilverCandidate(id: string, silver: SilverCandidate): void {
  const workflow = promotions.get(id);
  if (!workflow || workflow.promotion.stage !== "silver")
    throw new Error("Silver ingestion unavailable");
  promotions.set(id, { ...workflow, silver });
}

/** Returns separately approved Silver plus its Bronze provenance for Gold formalization. */
export function getApprovedSilverForGold(id: string): {
  readonly approvedSilver: SilverCandidate;
  readonly framework: string;
  readonly sourceFingerprint: string;
} {
  const workflow = promotions.get(id);
  if (
    !workflow?.bronze ||
    !workflow.silver ||
    workflow.promotion.stage !== "silver-approved"
  )
    throw new Error("Silver approval required");
  return {
    approvedSilver: workflow.silver,
    framework: workflow.bronze.fileName,
    sourceFingerprint: workflow.bronze.fingerprint,
  };
}

/** Retains a validated Gold handoff until semantic persistence completes. */
export function saveGoldCandidate(id: string, gold: GoldCandidate): void {
  const workflow = promotions.get(id);
  if (!workflow || workflow.promotion.stage !== "gold")
    throw new Error("Gold formalization unavailable");
  promotions.set(id, { ...workflow, gold });
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
  promotions.set(id, { ...workflow, promotion: next });
  return next;
}

/** Discards an unfinished local workflow and all of its temporary artifacts. */
export function expireTemporaryPromotion(id: string): void {
  promotions.delete(id);
}
