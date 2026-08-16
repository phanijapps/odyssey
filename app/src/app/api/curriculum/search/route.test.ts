import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import queries from "../../../../server/curriculum/sqlite-queries.json";
import { deleteGoldRecord } from "../../../../server/curriculum/gold-query";
import { CurriculumVectorRepository } from "../../../../server/curriculum/vector-repository";

const mocks = vi.hoisted(() => ({ embedCurriculumText: vi.fn() }));

vi.mock("../../../../server/curriculum/ollama-embeddings", () => ({
  embedCurriculumText: mocks.embedCurriculumText,
}));

import { GET } from "./route";

const originalDatabasePath = process.env.ODYSSEY_CURRICULUM_DB_PATH;
let directory = "";
let databasePath = "";

function restoreDatabasePath(): void {
  if (originalDatabasePath === undefined)
    delete process.env.ODYSSEY_CURRICULUM_DB_PATH;
  else process.env.ODYSSEY_CURRICULUM_DB_PATH = originalDatabasePath;
}

function insertGoldRecord(
  database: DatabaseSync,
  repository: CurriculumVectorRepository,
  input: {
    readonly id: string;
    readonly grade: string;
    readonly vector: readonly number[];
  },
): void {
  const content = {
    id: input.id,
    subject: "mathematics",
    framework: "fixture-framework",
    gradeOrCourse: input.grade,
    domain: "Ratios",
    cluster: "Ratio reasoning",
    standardCode: input.id,
    standardText: `${input.id} ratio reasoning`,
    source: { documentId: "fixture", page: 1 },
    topics: ["ratio"],
    assessmentTargets: [],
  };
  database
    .prepare(queries.upsertGoldRecord)
    .run(
      input.id,
      content.subject,
      content.framework,
      JSON.stringify(content),
      "fixture-source",
      "fixture-v1",
      "fixture-model",
      "2026-01-01T00:00:00.000Z",
    );
  repository.save({
    recordId: input.id,
    subject: content.subject,
    framework: content.framework,
    model: "fixture-model",
    contentFingerprint: input.id,
    vector: input.vector,
  });
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "odyssey-curriculum-search-"));
  databasePath = join(directory, "curriculum.db");
  process.env.ODYSSEY_CURRICULUM_DB_PATH = databasePath;
  mocks.embedCurriculumText.mockReset();
});

afterEach(() => {
  restoreDatabasePath();
  rmSync(directory, { force: true, recursive: true });
});

test("uses one query embedding and persisted vectors rather than embedding every Gold record", async () => {
  const database = new DatabaseSync(databasePath, { allowExtension: true });
  database.exec(queries.initializeGoldRecords);
  const repository = new CurriculumVectorRepository(database);
  const vector = Array.from({ length: 768 }, () => 0);
  insertGoldRecord(database, repository, {
    id: "gold-a",
    grade: "Grade 6",
    vector,
  });
  insertGoldRecord(database, repository, {
    id: "gold-b",
    grade: "Grade 6",
    vector,
  });
  insertGoldRecord(database, repository, {
    id: "gold-c",
    grade: "Grade 6",
    vector,
  });
  database.close();
  mocks.embedCurriculumText.mockResolvedValue(vector);

  const response = await GET(
    new Request("http://localhost/api/curriculum/search?q=ratio&semantic=1"),
  );

  expect(mocks.embedCurriculumText).toHaveBeenCalledOnce();
  await expect(response.json()).resolves.toEqual(
    expect.objectContaining({
      semantic: true,
      total: 3,
      results: expect.arrayContaining([
        expect.objectContaining({ id: "gold-a", score: expect.any(Number) }),
      ]),
    }),
  );
});

test("returns only current Gold results after a record is deleted", async () => {
  const database = new DatabaseSync(databasePath, { allowExtension: true });
  database.exec(queries.initializeGoldRecords);
  const repository = new CurriculumVectorRepository(database);
  const vector = Array.from({ length: 768 }, () => 0);
  insertGoldRecord(database, repository, {
    id: "gold-current",
    grade: "Grade 6",
    vector,
  });
  database.close();
  mocks.embedCurriculumText.mockResolvedValue(vector);

  const beforeDelete = await GET(
    new Request(
      "http://localhost/api/curriculum/search?q=ratio&semantic=1&grade=Grade%206",
    ),
  );
  await expect(beforeDelete.json()).resolves.toEqual(
    expect.objectContaining({
      semantic: true,
      results: [expect.objectContaining({ id: "gold-current" })],
    }),
  );

  expect(deleteGoldRecord("gold-current")).toBe(true);
  const projections = new DatabaseSync(databasePath, { allowExtension: true });
  expect(
    projections
      .prepare("SELECT record_id FROM curriculum_embedding_records")
      .all(),
  ).toEqual([]);
  projections.close();
  const afterDelete = await GET(
    new Request(
      "http://localhost/api/curriculum/search?q=ratio&semantic=1&grade=Grade%206",
    ),
  );
  await expect(afterDelete.json()).resolves.toEqual({
    results: [],
    total: 0,
    semantic: true,
  });
});
