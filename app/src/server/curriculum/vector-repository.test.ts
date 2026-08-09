import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import { CurriculumVectorRepository } from "./vector-repository";

test("stores a fixed-dimension local curriculum embedding", () => {
  const database = new DatabaseSync(":memory:", { allowExtension: true });
  const repository = new CurriculumVectorRepository(database);
  repository.save({
    recordId: "ohio-math-2017:6:rp:1",
    subject: "mathematics",
    framework: "ohio-learning-standards-2017",
    model: "nomic-embed-text:latest",
    contentFingerprint: "abc",
    vector: Array.from({ length: 768 }, () => 0),
  });
  expect(
    database.prepare("SELECT record_id, dimension FROM curriculum_embedding_records").get(),
  ).toEqual({ record_id: "ohio-math-2017:6:rp:1", dimension: 768 });
  repository.save({
    recordId: "other-framework:6:rp:1",
    subject: "mathematics",
    framework: "other-framework",
    model: "nomic-embed-text:latest",
    contentFingerprint: "def",
    vector: Array.from({ length: 768 }, (_, index) => (index === 0 ? 1 : 0)),
  });
  expect(
    repository.findNearest({
      vector: Array.from({ length: 768 }, () => 0),
      subject: "mathematics",
      framework: "ohio-learning-standards-2017",
      limit: 5,
    }),
  ).toEqual([{ recordId: "ohio-math-2017:6:rp:1", distance: 0 }]);
  database.close();
});
