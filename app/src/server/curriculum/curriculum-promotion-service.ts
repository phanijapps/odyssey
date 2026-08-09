import "server-only";
import type { SilverCandidate } from "./curriculum-pi-agent";
import {
  advancePromotion,
  getApprovedBronzeForSilver,
  saveSilverCandidate,
} from "./promotion-store";

type SilverRunner = {
  run(input: {
    readonly stage: "bronze-to-silver";
    readonly input: unknown;
  }): Promise<SilverCandidate>;
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
