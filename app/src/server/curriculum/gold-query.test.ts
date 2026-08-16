import { afterEach, beforeEach, expect, test } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { resolveGoldRecordsForAssessment } from "./gold-query";

let directory = "";
let databasePath = "";
let previousPath: string | undefined;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "odyssey-gold-query-"));
  databasePath = join(directory, "curriculum.db");
  previousPath = process.env.ODYSSEY_CURRICULUM_DB_PATH;
  process.env.ODYSSEY_CURRICULUM_DB_PATH = databasePath;
  const db = new DatabaseSync(databasePath);
  db.exec(`CREATE TABLE gold_curriculum_records (
    record_id TEXT PRIMARY KEY, subject TEXT NOT NULL, framework TEXT NOT NULL,
    content_json TEXT NOT NULL, source_fingerprint TEXT NOT NULL,
    prompt_version TEXT NOT NULL, model TEXT NOT NULL, created_at TEXT NOT NULL
  )`);
  const insert = db.prepare(`INSERT INTO gold_curriculum_records
    (record_id, subject, framework, content_json, source_fingerprint, prompt_version, model, created_at)
    VALUES (?, ?, 'fixture', ?, 'source', 'v1', 'fixture', '2026-01-01')`);
  for (const [id, subject, grade] of [
    ["gold-a", "Mathematics", "Grade 6"],
    ["gold-b", "Mathematics", "Grade 6"],
    ["gold-c", "Mathematics", "Grade 7"],
    ["gold-english", "English Language Arts", "Grade 6"],
  ]) {
    insert.run(
      id,
      subject,
      JSON.stringify({
        id: `${id}-content-id`,
        subject,
        gradeOrCourse: grade,
        domain: "Fixture",
        standardCode: id,
        standardText: `${id} reviewed text`,
        topics: ["fixture"],
        source: { documentId: "fixture", page: 1 },
      }),
    );
  }
  db.close();
});

afterEach(async () => {
  if (previousPath === undefined) delete process.env.ODYSSEY_CURRICULUM_DB_PATH;
  else process.env.ODYSSEY_CURRICULUM_DB_PATH = previousPath;
  await rm(directory, { force: true, recursive: true });
});

test("resolves selected primary keys in order and freezes reviewed content", () => {
  const resolved = resolveGoldRecordsForAssessment(["gold-b", "gold-a"]);

  expect(resolved.map((record) => record.recordId)).toEqual([
    "gold-b",
    "gold-a",
  ]);
  expect(resolved.map((record) => record.content.id)).toEqual([
    "gold-b-content-id",
    "gold-a-content-id",
  ]);
  expect(resolved[0]).toMatchObject({
    subject: "Mathematics",
    grade: "Grade 6",
    contentFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
  });
});

test("rejects unavailable, duplicate, non-math, and cross-grade selections", () => {
  for (const ids of [
    ["missing"],
    ["gold-a", "gold-a"],
    ["gold-a", "gold-c"],
    ["gold-english"],
    ["gold-a", "gold-b", "gold-c", "gold-english"],
  ]) {
    expect(() => resolveGoldRecordsForAssessment(ids)).toThrow(
      "Invalid selected Gold records",
    );
  }
});
