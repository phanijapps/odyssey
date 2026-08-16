/** The only application-owned curriculum promotion states. */
export type CurriculumPromotion = {
  readonly id: string;
  readonly stage:
    | "bronze"
    | "bronze-approved"
    | "silver"
    | "silver-approved"
    | "gold";
};

/** Records the Curriculum Steward's approval of a Bronze result. */
export function approveBronze(input: CurriculumPromotion): CurriculumPromotion {
  if (input.stage !== "bronze") throw new Error("Bronze approval unavailable");
  return { ...input, stage: "bronze-approved" };
}

/** Invokes the Silver synthesis stage only after Bronze approval. */
export function ingestSilver(input: CurriculumPromotion): CurriculumPromotion {
  if (input.stage !== "bronze-approved")
    throw new Error("Bronze approval required");
  return { ...input, stage: "silver" };
}

/** Records the Curriculum Steward's approval of a Silver result. */
export function approveSilver(input: CurriculumPromotion): CurriculumPromotion {
  if (input.stage !== "silver") throw new Error("Silver approval unavailable");
  return { ...input, stage: "silver-approved" };
}

/** Invokes Gold formalization only after Silver approval. */
export function ingestGold(input: CurriculumPromotion): CurriculumPromotion {
  if (input.stage !== "silver-approved")
    throw new Error("Silver approval required");
  return { ...input, stage: "gold" };
}
