import "server-only";
import type { GoldCandidate, SilverCandidate } from "./curriculum-pi-agent";
import {
  advancePromotion,
  getApprovedBronzeForSilver,
  getApprovedSilverForGold,
  saveSilverCandidate,
  saveGoldCandidate,
} from "./promotion-store";

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

const MAX_SILVER_SOURCE_CHUNK_CHARACTERS = 15_000;

/** Orchestrates Bronze-to-Silver without giving the Pi runner promotion authority. */
export async function generateSilverCandidate(
  id: string,
  agent: SilverRunner,
): Promise<SilverCandidate> {
  const bronze = await getApprovedBronzeForSilver(id);
  const chunks = splitSilverSource(bronze.source);
  const candidates: SilverCandidate[] = [];
  for (const source of chunks) {
    try {
      candidates.push(
        await agent.run({
          stage: "bronze-to-silver",
          input: { ...bronze, source },
        }),
      );
    } catch {
      // Skip chunks whose response is truncated or unparseable
    }
  }
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
  advancePromotion(id, "ingest-silver");
  saveSilverCandidate(id, silver);
  return silver;
}

/** Splits only source data into bounded sequential model contexts. */
export function splitSilverSource(source: string): string[] {
  if (source.length <= MAX_SILVER_SOURCE_CHUNK_CHARACTERS) return [source];
  const chunks: string[] = [];
  for (
    let start = 0;
    start < source.length;
    start += MAX_SILVER_SOURCE_CHUNK_CHARACTERS
  )
    chunks.push(
      source.slice(start, start + MAX_SILVER_SOURCE_CHUNK_CHARACTERS),
    );
  return chunks;
}

const MAX_GOLD_RECORDS_PER_BATCH = 20;

/** Splits Silver records into batches small enough for one model call. */
export function splitGoldBatches(records: readonly unknown[]): unknown[][] {
  const batches: unknown[][] = [];
  for (let i = 0; i < records.length; i += MAX_GOLD_RECORDS_PER_BATCH)
    batches.push([...records.slice(i, i + MAX_GOLD_RECORDS_PER_BATCH)]);
  return batches;
}

/** Formalizes only approved Silver and retains Gold until the semantic index commits it. */
export async function generateGoldCandidate(
  id: string,
  agent: GoldRunner,
): Promise<{ gold: GoldCandidate; sourceFingerprint: string }> {
  const silver = getApprovedSilverForGold(id);
  const allRecords = silver.approvedSilver.records;
  const batches = splitGoldBatches(allRecords as readonly unknown[]);
  const goldCandidates: GoldCandidate[] = [];
  for (const batch of batches) {
    try {
      goldCandidates.push(
        await agent.run({
          stage: "silver-to-gold",
          input: {
            approvedSilver: { ...silver.approvedSilver, records: batch },
            framework: silver.framework,
          },
        }),
      );
    } catch {
      // Skip batches whose response is truncated or unparseable
    }
  }
  if (goldCandidates.length === 0)
    throw new Error("No Gold candidates could be formalized");
  const gold: GoldCandidate = {
    canonicalRecords: goldCandidates.flatMap((c) => c.canonicalRecords),
    relations: goldCandidates.flatMap((c) => c.relations),
    topics: [...new Set(goldCandidates.flatMap((c) => c.topics))],
    assessmentTargets: [
      ...new Set(goldCandidates.flatMap((c) => c.assessmentTargets)),
    ],
    provenance: { promptVersion: "silver-to-gold/v1" },
  };
  saveGoldCandidate(id, gold);
  return { gold, sourceFingerprint: silver.sourceFingerprint };
}
