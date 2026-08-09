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

/** Orchestrates Bronze-to-Silver without giving the Pi runner promotion authority. */
export async function generateSilverCandidate(
  id: string,
  agent: SilverRunner,
): Promise<SilverCandidate> {
  const bronze = getApprovedBronzeForSilver(id);
  const silver = await agent.run({ stage: "bronze-to-silver", input: bronze });
  advancePromotion(id, "ingest-silver");
  saveSilverCandidate(id, silver);
  return silver;
}

/** Formalizes only approved Silver and retains Gold until the semantic index commits it. */
export async function generateGoldCandidate(
  id: string,
  agent: GoldRunner,
): Promise<{ gold: GoldCandidate; sourceFingerprint: string }> {
  const silver = getApprovedSilverForGold(id);
  const gold = await agent.run({
    stage: "silver-to-gold",
    input: {
      approvedSilver: silver.approvedSilver,
      framework: silver.framework,
    },
  });
  advancePromotion(id, "ingest-gold");
  saveGoldCandidate(id, gold);
  return { gold, sourceFingerprint: silver.sourceFingerprint };
}
