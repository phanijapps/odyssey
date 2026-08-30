import { afterEach, beforeEach, expect, test } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import queries from "../../../../server/curriculum/sqlite-queries.json";

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
  input: {
    readonly id: string;
    readonly grade: string;
    readonly standardText?: string;
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
    standardText: input.standardText ?? `${input.id} ratio reasoning`,
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
}

beforeEach(() => {
  process.env.ODYSSEY_SEED_CATALOG = "0";
  directory = mkdtempSync(join(tmpdir(), "odyssey-search-test-"));
  databasePath = join(directory, "curriculum.db");
  process.env.ODYSSEY_CURRICULUM_DB_PATH = databasePath;
  const database = new DatabaseSync(databasePath);
  database.exec(
    `CREATE TABLE gold_curriculum_records (
      record_id TEXT PRIMARY KEY, subject TEXT NOT NULL, framework TEXT NOT NULL,
      content_json TEXT NOT NULL, source_fingerprint TEXT NOT NULL,
      prompt_version TEXT NOT NULL, model TEXT NOT NULL, created_at TEXT NOT NULL
    );`,
  );
  insertGoldRecord(database, { id: "6.RP.1", grade: "Grade 6" });
  insertGoldRecord(database, { id: "6.RP.2", grade: "Grade 6" });
  insertGoldRecord(database, { id: "8.NS.1", grade: "Grade 8" });
  database.close();
});

afterEach(() => {
  restoreDatabasePath();
  if (directory) rmSync(directory, { force: true, recursive: true });
  if (originalDatabasePath !== undefined)
    process.env.ODYSSEY_SEED_CATALOG = "0";
});

test("returns standards filtered by grade with an empty query", async () => {
  const response = await GET(
    new Request("http://localhost/api/curriculum/search?grade=Grade+6"),
  );
  const body = (await response.json()) as {
    results: { standardCode: string }[];
    total: number;
  };
  expect(body.total).toBe(2);
  expect(body.results.map((r) => r.standardCode)).toEqual(["6.RP.1", "6.RP.2"]);
});

test("text search ranks an exact standard-code match first", async () => {
  const response = await GET(
    new Request("http://localhost/api/curriculum/search?q=6.RP.2"),
  );
  const body = (await response.json()) as {
    results: { standardCode: string; score: number }[];
  };
  expect(body.results[0].standardCode).toBe("6.RP.2");
  expect(body.results[0].score).toBeGreaterThan(0);
});

test("text search matches query words in standard text", async () => {
  const response = await GET(
    new Request("http://localhost/api/curriculum/search?q=ratio+reasoning"),
  );
  const body = (await response.json()) as {
    results: { standardCode: string }[];
  };
  expect(body.results.length).toBe(3);
});

test("the semantic parameter is inert — text contract only", async () => {
  const response = await GET(
    new Request("http://localhost/api/curriculum/search?q=6.RP.1&semantic=1"),
  );
  const body = (await response.json()) as {
    results: { standardCode: string }[];
    semantic?: boolean;
  };
  expect(body.semantic).toBeUndefined();
  expect(body.results[0].standardCode).toBe("6.RP.1");
});

test("caps an unbounded limit request at the maximum", async () => {
  const response = await GET(
    new Request("http://localhost/api/curriculum/search?limit=5000"),
  );
  expect(response.status).toBe(200);
  const body = (await response.json()) as { results: unknown[] };
  expect(body.results.length).toBeLessThanOrEqual(50);
});
