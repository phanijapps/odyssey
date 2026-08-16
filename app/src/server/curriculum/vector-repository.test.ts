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
    database
      .prepare("SELECT record_id, dimension FROM curriculum_embedding_records")
      .get(),
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

test("removes the metadata and nearest-vector projection together", () => {
  const database = new DatabaseSync(":memory:", { allowExtension: true });
  const repository = new CurriculumVectorRepository(database);
  repository.save({
    recordId: "generic:6:ratio:1",
    subject: "mathematics",
    framework: "generic-framework",
    model: "nomic-embed-text:latest",
    contentFingerprint: "abc",
    vector: Array.from({ length: 768 }, () => 0),
  });

  expect(repository.remove("generic:6:ratio:1")).toBe(true);
  expect(
    repository.findNearest({
      vector: Array.from({ length: 768 }, () => 0),
      limit: 20,
    }),
  ).toEqual([]);
  expect(
    database
      .prepare("SELECT record_id FROM curriculum_embedding_records")
      .all(),
  ).toEqual([]);
  database.close();
});
