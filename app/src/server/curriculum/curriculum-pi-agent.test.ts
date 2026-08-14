import { expect, test, vi } from "vitest";
import { CurriculumPiAgent } from "./curriculum-pi-agent";

const silverOutput = {
  sourceSummary: "A Grade 6 source about ratios.",
  records: [
    {
      recordId: "source:1",
      title: "Ratio reasoning",
      officialText: "Use ratio reasoning to solve problems.",
      source: { page: 1 },
    },
  ],
  warnings: [],
};

test("uses the Bronze cleanup prompt and validates JSON-only Silver output", async () => {
  const invoke = vi.fn().mockResolvedValue(JSON.stringify(silverOutput));
  const agent = new CurriculumPiAgent(invoke);

  await expect(
    agent.run({
      stage: "bronze-to-silver",
      input: {
        source: "Grade 6 ratio standard",
        sourceFingerprint: "a".repeat(64),
        format: "text",
      },
    }),
  ).resolves.toEqual({
    ...silverOutput,
    provenance: { promptVersion: "bronze-to-silver/v1" },
  });
  expect(invoke).toHaveBeenCalledWith(
    expect.objectContaining({
      stage: "bronze-to-silver",
      promptPath: expect.stringContaining("bronze-to-silver.system.md"),
      data: expect.stringContaining("<curriculum-data>"),
    }),
  );
});

test("rejects malformed agent output and inputs beyond the bounded request size", async () => {
  const agent = new CurriculumPiAgent(async () => "not-json");
  await expect(
    agent.run({
      stage: "bronze-to-silver",
      input: { source: "source", sourceFingerprint: "a", format: "text" },
    }),
  ).rejects.toThrow("Invalid Pi JSON response");
  await expect(
    agent.run({
      stage: "bronze-to-silver",
      input: { source: "x".repeat(120_001) },
    }),
  ).rejects.toThrow("Curriculum Pi input exceeds limit");
});
