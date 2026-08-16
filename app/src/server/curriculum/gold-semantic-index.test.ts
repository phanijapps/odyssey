import { DatabaseSync } from "node:sqlite";
import { expect, test, vi } from "vitest";
import { GoldSemanticIndex } from "./gold-semantic-index";
import queries from "./sqlite-queries.json";

test("persists only Gold records with provenance, graph projection, and local vectors", async () => {
  const database = new DatabaseSync(":memory:", { allowExtension: true });
  const writeGraph = vi.fn().mockResolvedValue(true);
  const index = new GoldSemanticIndex({
    database,
    writeGraph,
    embed: async () => Array.from({ length: 768 }, () => 0),
  });
  const record = {
    id: "generic:6:ratio:1",
    subject: "mathematics",
    framework: "generic-framework",
    gradeOrCourse: "6",
    domain: "Ratios",
    cluster: "Reason about ratios",
    standardCode: "R.1",
    standardText: "Use ratio reasoning.",
    source: { documentId: "framework", page: 1 },
    topics: ["ratio"],
    assessmentTargets: ["solve-ratios"],
  };

  await expect(
    index.persist({
      canonicalRecords: [record],
      relations: [{ from: record.id, to: "ratio", type: "about" }],
      sourceFingerprint: "e".repeat(64),
      promptVersion: "silver-to-gold/v1",
      model: "glm-5.2:cloud",
    }),
  ).resolves.toEqual({ recordCount: 1, graphProjected: true });
  expect(database.prepare(queries.selectGoldRecord).get(record.id)).toEqual({
    record_id: record.id,
    source_fingerprint: "e".repeat(64),
    prompt_version: "silver-to-gold/v1",
  });
  expect(writeGraph).toHaveBeenCalledWith(
    [record],
    [{ from: record.id, to: "ratio", type: "about" }],
  );
  database.close();
});

test("invalidates an existing vector projection when a Gold write cannot re-embed it", async () => {
  const database = new DatabaseSync(":memory:", { allowExtension: true });
  const writeGraph = vi.fn().mockResolvedValue(true);
  const vector = Array.from({ length: 768 }, () => 0);
  const index = new GoldSemanticIndex({
    database,
    writeGraph,
    embed: vi
      .fn()
      .mockResolvedValueOnce(vector)
      .mockRejectedValueOnce(new Error("Ollama unavailable")),
  });
  const record = {
    id: "generic:6:ratio:1",
    subject: "mathematics",
    framework: "generic-framework",
    gradeOrCourse: "6",
    domain: "Ratios",
    cluster: "Reason about ratios",
    standardCode: "R.1",
    standardText: "Use ratio reasoning.",
    source: { documentId: "framework", page: 1 },
    topics: ["ratio"],
    assessmentTargets: ["solve-ratios"],
  };
  const persist = () =>
    index.persist({
      canonicalRecords: [record],
      relations: [{ from: record.id, to: "ratio", type: "about" }],
      sourceFingerprint: "e".repeat(64),
      promptVersion: "silver-to-gold/v1",
      model: "glm-5.2:cloud",
    });

  await persist();
  expect(
    database
      .prepare("SELECT record_id FROM curriculum_embedding_records")
      .all(),
  ).toEqual([{ record_id: record.id }]);

  await persist();
  expect(
    database
      .prepare("SELECT record_id FROM curriculum_embedding_records")
      .all(),
  ).toEqual([]);
  database.close();
});
