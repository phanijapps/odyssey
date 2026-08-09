import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import type { CurriculumRecord } from "../../../../packages/curriculum/src/curriculum-model";
import { indexCurriculumRecords } from "./curriculum-indexer";
import { CurriculumVectorRepository } from "./vector-repository";

test("indexes source text through the supplied local embedding boundary", async () => {
  const database = new DatabaseSync(":memory:", { allowExtension: true });
  const repository = new CurriculumVectorRepository(database);
  const record: CurriculumRecord = {
    id: "ohio-math-2017:6.rp.1",
    subject: "mathematics",
    framework: "ohio-learning-standards-2017",
    gradeOrCourse: "Grade 6",
    domain: "Ratios",
    cluster: "Ratio concepts",
    standardCode: "6.RP.1",
    standardText: "Understand ratios.",
    source: { documentId: "ohio-math-2017", page: 41 },
    topics: [],
    assessmentTargets: [],
  };
  const count = await indexCurriculumRecords(
    [record],
    repository,
    async (text) => {
      expect(text).toContain("6.RP.1");
      return Array.from({ length: 768 }, () => 0);
    },
  );
  expect(count).toBe(1);
  expect(
    repository.findNearest({
      vector: Array.from({ length: 768 }, () => 0),
      subject: "mathematics",
      framework: "ohio-learning-standards-2017",
      limit: 1,
    }),
  ).toHaveLength(1);
  database.close();
});
