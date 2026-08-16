import { expect, test, vi } from "vitest";
import {
  advancePromotion,
  createTemporaryBronzePromotion,
  getTemporaryPromotionView,
} from "./promotion-store";
import {
  MAX_GOLD_RECORDS,
  MAX_SILVER_SOURCE_CHARACTERS,
  MAX_SILVER_SOURCE_CHUNK_CHARACTERS,
  generateGoldCandidate,
  generateSilverCandidate,
  splitGoldBatches,
  splitSilverSource,
  validateGoldCandidateAgainstSilver,
} from "./curriculum-promotion-service";
import type { GoldCandidate, SilverCandidate } from "./curriculum-pi-agent";

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

function goldCandidateFor(
  records: readonly SilverCandidate["records"][number][],
): GoldCandidate {
  return {
    canonicalRecords: records.map((record) => ({
      id: `gold:${record.recordId}`,
      subject: "mathematics",
      framework: "framework",
      gradeOrCourse: "Grade 6",
      domain: "Ratios",
      cluster: "Ratio reasoning",
      standardCode: record.recordId,
      standardText: record.officialText,
      source: { documentId: record.recordId, page: record.source.page },
      topics: [],
      assessmentTargets: [],
    })),
    relations: [],
    topics: [],
    assessmentTargets: [],
    provenance: { promptVersion: "silver-to-gold/v1" },
  };
}

function createWorkflow(id: string, source = "Ratio standard"): void {
  createTemporaryBronzePromotion({
    id,
    upload: {
      fileName: "framework.txt",
      mimeType: "text/plain",
      byteSize: source.length,
      format: "text",
      fingerprint: "d".repeat(64),
      warnings: [],
    },
    bytes: new TextEncoder().encode(source),
  });
}

async function approveSilver(
  id: string,
  candidate: SilverCandidate = silverCandidate,
): Promise<void> {
  advancePromotion(id, "approve-bronze");
  await generateSilverCandidate(id, {
    run: vi.fn().mockResolvedValue(candidate),
  });
  advancePromotion(id, "approve-silver");
}

test("generates a temporary Silver candidate only from approved Bronze", async () => {
  createWorkflow("silver-workflow");
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

test("keeps Bronze approved and records every failed Silver chunk", async () => {
  createWorkflow(
    "silver-chunk-failure",
    "x".repeat(MAX_SILVER_SOURCE_CHUNK_CHARACTERS + 1),
  );
  advancePromotion("silver-chunk-failure", "approve-bronze");
  const run = vi
    .fn()
    .mockResolvedValueOnce(silverCandidate)
    .mockRejectedValueOnce(new Error("truncated"));

  await expect(
    generateSilverCandidate("silver-chunk-failure", { run }),
  ).rejects.toMatchObject({
    stage: "silver",
    failures: [{ index: 1, message: "truncated" }],
  });
  expect(run).toHaveBeenCalledTimes(2);
  expect(getTemporaryPromotionView("silver-chunk-failure")).toEqual(
    expect.objectContaining({ stage: "bronze-approved" }),
  );
  expect(getTemporaryPromotionView("silver-chunk-failure")).not.toHaveProperty(
    "silver",
  );
});

test("bounds aggregate source and Gold batch inputs before model calls", () => {
  expect(() =>
    splitSilverSource("x".repeat(MAX_SILVER_SOURCE_CHARACTERS + 1)),
  ).toThrow("aggregate limit");
  expect(() =>
    splitGoldBatches(Array.from({ length: MAX_GOLD_RECORDS + 1 })),
  ).toThrow("aggregate record limit");
});

test("keeps Silver approved and records every failed Gold batch", async () => {
  const records = Array.from({ length: 21 }, (_, index) => ({
    recordId: `source:${index + 1}`,
    title: `Standard ${index + 1}`,
    officialText: `Official text ${index + 1}`,
    source: { page: index + 1 },
  }));
  const candidate = { ...silverCandidate, records };
  createWorkflow("gold-batch-failure");
  await approveSilver("gold-batch-failure", candidate);
  const run = vi
    .fn()
    .mockImplementationOnce(async (request) => {
      const input = request.input as { approvedSilver: SilverCandidate };
      return goldCandidateFor(input.approvedSilver.records);
    })
    .mockRejectedValueOnce(new Error("timeout"));

  await expect(
    generateGoldCandidate("gold-batch-failure", { run }),
  ).rejects.toMatchObject({
    stage: "gold",
    failures: [{ index: 1, message: "timeout" }],
  });
  expect(run).toHaveBeenCalledTimes(2);
  expect(getTemporaryPromotionView("gold-batch-failure")).toEqual(
    expect.objectContaining({ stage: "silver-approved" }),
  );
  expect(getTemporaryPromotionView("gold-batch-failure")).not.toHaveProperty(
    "gold",
  );
});

test("requires complete Gold source linkage, unique IDs, and valid relation endpoints", () => {
  const source = {
    ...silverCandidate,
    records: [
      ...silverCandidate.records,
      {
        recordId: "source:2",
        title: "Second standard",
        officialText: "Use proportional reasoning.",
        source: { page: 2 },
      },
    ],
  };
  const valid = goldCandidateFor(source.records);
  expect(() => validateGoldCandidateAgainstSilver(valid, source)).not.toThrow();

  expect(() =>
    validateGoldCandidateAgainstSilver(
      {
        ...valid,
        canonicalRecords: [
          valid.canonicalRecords[0],
          { ...valid.canonicalRecords[1], id: valid.canonicalRecords[0].id },
        ],
      },
      source,
    ),
  ).toThrow("duplicate record IDs");
  expect(() =>
    validateGoldCandidateAgainstSilver(
      {
        ...valid,
        canonicalRecords: [
          {
            ...valid.canonicalRecords[0],
            source: { documentId: "missing", page: 1 },
          },
          valid.canonicalRecords[1],
        ],
      },
      source,
    ),
  ).toThrow("does not match an approved Silver source");
  expect(() =>
    validateGoldCandidateAgainstSilver(
      {
        ...valid,
        relations: [
          {
            from: valid.canonicalRecords[0].id,
            to: "missing",
            type: "requires",
          },
        ],
      },
      source,
    ),
  ).toThrow("relation endpoint");
});
