import { expect, test, vi } from "vitest";
import {
  advancePromotion,
  createTemporaryBronzePromotion,
  getTemporaryPromotionView,
} from "./promotion-store";
import { generateSilverCandidate } from "./curriculum-promotion-service";
import type { SilverCandidate } from "./curriculum-pi-agent";

const silverCandidate: SilverCandidate = {
  sourceSummary: "Ratio standard.",
  records: [
    {
      recordId: "source:1",
      title: "Ratio reasoning",
      officialText: "Use ratio reasoning.",
      source: { page: 1 },
    },
  ],
  warnings: [],
  provenance: { promptVersion: "bronze-to-silver/v1" },
};

test("generates a temporary Silver candidate only from approved Bronze", async () => {
  createTemporaryBronzePromotion({
    id: "silver-workflow",
    upload: {
      fileName: "framework.txt",
      mimeType: "text/plain",
      byteSize: 13,
      format: "text",
      fingerprint: "d".repeat(64),
      warnings: [],
    },
    bytes: new TextEncoder().encode("Ratio standard"),
  });
  const run = vi.fn().mockResolvedValue(silverCandidate);

  await expect(
    generateSilverCandidate("silver-workflow", { run }),
  ).rejects.toThrow("Bronze approval required");
  advancePromotion("silver-workflow", "approve-bronze");
  await expect(
    generateSilverCandidate("silver-workflow", { run }),
  ).resolves.toEqual(silverCandidate);
  expect(run).toHaveBeenCalledWith({
    stage: "bronze-to-silver",
    input: {
      source: "Ratio standard",
      sourceFingerprint: "d".repeat(64),
      format: "text",
    },
  });
  expect(getTemporaryPromotionView("silver-workflow")).toMatchObject({
    stage: "silver",
    silver: { sourceSummary: "Ratio standard." },
  });
});
