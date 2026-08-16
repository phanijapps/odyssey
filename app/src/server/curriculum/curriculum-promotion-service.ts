import "server-only";
import type { GoldCandidate, SilverCandidate } from "./curriculum-pi-agent";
import {
  completeSilverPromotion,
  getApprovedBronzeForSilver,
  getApprovedSilverForGold,
  saveGoldCandidate,
} from "./promotion-store";

export const MAX_SILVER_SOURCE_CHUNK_CHARACTERS = 15_000;
export const MAX_SILVER_SOURCE_CHUNKS = 8;
export const MAX_SILVER_SOURCE_CHARACTERS =
  MAX_SILVER_SOURCE_CHUNK_CHARACTERS * MAX_SILVER_SOURCE_CHUNKS;
export const MAX_GOLD_RECORDS_PER_BATCH = 20;
export const MAX_GOLD_BATCHES = 5;
export const MAX_GOLD_RECORDS = MAX_GOLD_RECORDS_PER_BATCH * MAX_GOLD_BATCHES;
export const MAX_GOLD_APPROVED_SILVER_CHARACTERS = 100_000;

type SilverRunner = {
  run(input: {
    readonly stage: "bronze-to-silver";
    readonly input: unknown;
  }): Promise<SilverCandidate>;
};

type GoldRunner = {
  run(input: {
    readonly stage: "silver-to-gold";
    readonly input: unknown;
  }): Promise<GoldCandidate>;
};

export type PromotionGenerationFailure = {
  readonly index: number;
  readonly message: string;
};

/** Reports every bounded model call that failed without publishing its partial peers. */
export class PromotionGenerationError extends Error {
  constructor(
    readonly stage: "silver" | "gold",
    readonly failures: readonly PromotionGenerationFailure[],
  ) {
    super(
      `${stage === "silver" ? "Silver" : "Gold"} generation failed for ${failures.length} ${stage === "silver" ? "chunk" : "batch"}(s)`,
    );
    this.name = "PromotionGenerationError";
  }
}

/** Orchestrates Bronze-to-Silver without giving the Pi runner promotion authority. */
export async function generateSilverCandidate(
  id: string,
  agent: SilverRunner,
): Promise<SilverCandidate> {
  const bronze = await getApprovedBronzeForSilver(id);
  const chunks = splitSilverSource(bronze.source);
  const candidates: SilverCandidate[] = [];
  const failures: PromotionGenerationFailure[] = [];

  for (const [index, source] of chunks.entries()) {
    try {
      candidates.push(
        await agent.run({
          stage: "bronze-to-silver",
          input: { ...bronze, source },
        }),
      );
    } catch (error) {
      failures.push({ index, message: failureMessage(error) });
    }
  }
  if (failures.length) throw new PromotionGenerationError("silver", failures);

  const silver: SilverCandidate = {
    sourceSummary: candidates
      .map((candidate) => candidate.sourceSummary)
      .join("\n"),
    records: candidates.flatMap((candidate) => candidate.records),
    warnings: [
      ...new Set(candidates.flatMap((candidate) => candidate.warnings)),
    ],
    provenance: { promptVersion: "bronze-to-silver/v1" },
  };
  ensureUniqueSilverRecordIds(silver);
  completeSilverPromotion(id, silver);
  return silver;
}

/** Splits only bounded source data into a bounded number of model contexts. */
export function splitSilverSource(source: string): string[] {
  if (source.length > MAX_SILVER_SOURCE_CHARACTERS)
    throw new Error("Curriculum source exceeds aggregate limit");
  const chunks: string[] = [];
  for (
    let start = 0;
    start < source.length;
    start += MAX_SILVER_SOURCE_CHUNK_CHARACTERS
  )
    chunks.push(
      source.slice(start, start + MAX_SILVER_SOURCE_CHUNK_CHARACTERS),
    );
  return chunks.length ? chunks : [""];
}

/** Splits approved Silver records into a bounded number of model calls. */
export function splitGoldBatches<T>(records: readonly T[]): T[][] {
  if (records.length > MAX_GOLD_RECORDS)
    throw new Error("Approved Silver exceeds aggregate record limit");
  const batches: T[][] = [];
  for (let i = 0; i < records.length; i += MAX_GOLD_RECORDS_PER_BATCH)
    batches.push([...records.slice(i, i + MAX_GOLD_RECORDS_PER_BATCH)]);
  return batches;
}

/** Formalizes approved Silver and retains a complete, validated Gold candidate for finalization. */
export async function generateGoldCandidate(
  id: string,
  agent: GoldRunner,
): Promise<{ gold: GoldCandidate; sourceFingerprint: string }> {
  const silver = getApprovedSilverForGold(id);
  ensureAggregateGoldInputBound(silver.approvedSilver);
  ensureUniqueSilverRecordIds(silver.approvedSilver);
  const batches = splitGoldBatches(silver.approvedSilver.records);
  if (!batches.length) throw new Error("Approved Silver contains no records");

  const goldCandidates: GoldCandidate[] = [];
  const failures: PromotionGenerationFailure[] = [];
  for (const [index, batch] of batches.entries()) {
    try {
      const candidate = await agent.run({
        stage: "silver-to-gold",
        input: {
          approvedSilver: { ...silver.approvedSilver, records: batch },
          framework: silver.framework,
        },
      });
      validateGoldSourceLinks(candidate, batch);
      goldCandidates.push(candidate);
    } catch (error) {
      failures.push({ index, message: failureMessage(error) });
    }
  }
  if (failures.length) throw new PromotionGenerationError("gold", failures);

  const gold: GoldCandidate = {
    canonicalRecords: goldCandidates.flatMap(
      (candidate) => candidate.canonicalRecords,
    ),
    relations: goldCandidates.flatMap((candidate) => candidate.relations),
    topics: [
      ...new Set(goldCandidates.flatMap((candidate) => candidate.topics)),
    ],
    assessmentTargets: [
      ...new Set(
        goldCandidates.flatMap((candidate) => candidate.assessmentTargets),
      ),
    ],
    provenance: { promptVersion: "silver-to-gold/v1" },
  };
  validateGoldCandidateAgainstSilver(gold, silver.approvedSilver);
  saveGoldCandidate(id, gold);
  return { gold, sourceFingerprint: silver.sourceFingerprint };
}

/** Ensures every Gold record is a one-to-one, source-backed formalization of Silver. */
export function validateGoldCandidateAgainstSilver(
  gold: GoldCandidate,
  silver: Pick<SilverCandidate, "records">,
): void {
  validateGoldSourceLinks(gold, silver.records);
  const goldIds = gold.canonicalRecords.map((record) => record.id);
  if (new Set(goldIds).size !== goldIds.length)
    throw new Error("Gold candidate contains duplicate record IDs");
  const goldIdsSet = new Set(goldIds);
  if (
    gold.relations.some(
      (relation) =>
        !goldIdsSet.has(relation.from) || !goldIdsSet.has(relation.to),
    )
  )
    throw new Error("Gold relation endpoint is not a Gold record");
}

function validateGoldSourceLinks(
  gold: GoldCandidate,
  silverRecords: readonly SilverCandidate["records"][number][],
): void {
  const silverById = new Map(
    silverRecords.map((record) => [record.recordId, record]),
  );
  if (silverById.size !== silverRecords.length)
    throw new Error("Silver candidate contains duplicate record IDs");
  const linkedSilverIds = gold.canonicalRecords.map(
    (record) => record.source.documentId,
  );
  if (
    gold.canonicalRecords.some((record) => {
      const source = silverById.get(record.source.documentId);
      return (
        !source ||
        source.source.page !== record.source.page ||
        source.officialText !== record.standardText
      );
    })
  )
    throw new Error("Gold record does not match an approved Silver source");
  if (
    linkedSilverIds.length !== silverRecords.length ||
    new Set(linkedSilverIds).size !== silverRecords.length
  )
    throw new Error(
      "Gold candidate must contain one record for each Silver source",
    );
}

function ensureUniqueSilverRecordIds(
  silver: Pick<SilverCandidate, "records">,
): void {
  if (
    new Set(silver.records.map((record) => record.recordId)).size !==
    silver.records.length
  )
    throw new Error("Silver candidate contains duplicate record IDs");
}

function ensureAggregateGoldInputBound(silver: SilverCandidate): void {
  const serialized = JSON.stringify(silver);
  if (serialized.length > MAX_GOLD_APPROVED_SILVER_CHARACTERS)
    throw new Error("Approved Silver exceeds aggregate input limit");
}

function failureMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown model failure";
}
