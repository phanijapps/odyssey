import { describe, expect, test } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { openDatabase } from "../src/client";
import { ensureCatalogSeeded, reviewedCatalogSize } from "../src/catalog-seed";
import { getBrowseTree } from "../src/repositories/browse";

function freshCurriculumDatabase(): DatabaseSync {
  return openDatabase("curriculum");
}

describe("reviewed catalog seeder (RFC-0006 phase 3a)", () => {
  test("seeds the full reviewed catalog into an empty store", () => {
    const database = freshCurriculumDatabase();
    try {
      ensureCatalogSeeded(database);
      const count = database
        .prepare("SELECT count(*) AS n FROM gold_curriculum_records")
        .get() as { n: number };
      expect(count.n).toBe(reviewedCatalogSize());
      expect(count.n).toBeGreaterThan(700);
    } finally {
      database.close();
    }
  });

  test("a seeded store serves the full browse tree (fresh-clone fix)", () => {
    const database = freshCurriculumDatabase();
    try {
      ensureCatalogSeeded(database);
      const tree = getBrowseTree();
      const subjects = tree.subjects.map((subject) => subject.subject);
      expect(subjects).toContain("Mathematics");
      const grades = tree.subjects[0].grades;
      expect(grades.length).toBeGreaterThan(3);
      const domains = grades[0].domains;
      expect(domains.length).toBeGreaterThan(0);
      expect(domains[0].standards.length).toBeGreaterThan(0);
    } finally {
      database.close();
    }
  });

  test("re-seeding is idempotent and preserves unrelated records", () => {
    const database = freshCurriculumDatabase();
    try {
      ensureCatalogSeeded(database);
      const extra = database
        .prepare(
          `INSERT INTO gold_curriculum_records
           (record_id, subject, framework, content_json, source_fingerprint, prompt_version, model, created_at)
           VALUES ('local-extra', 'Mathematics', 'Ohio Learning Standards', '{}', 'f', 'p', 'm', '2026-01-01T00:00:00.000Z')`,
        )
        .run();
      expect(extra.changes).toBe(1);

      ensureCatalogSeeded(database);
      ensureCatalogSeeded(database);

      const count = database
        .prepare(
          "SELECT count(*) AS n FROM gold_curriculum_records WHERE record_id = 'local-extra'",
        )
        .get() as { n: number };
      expect(count.n).toBe(1);
      const total = database
        .prepare("SELECT count(*) AS n FROM gold_curriculum_records")
        .get() as { n: number };
      expect(total.n).toBe(reviewedCatalogSize() + 1);
    } finally {
      database.close();
    }
  });

  test("seeded content matches the reviewed JSON exactly", () => {
    const database = freshCurriculumDatabase();
    try {
      ensureCatalogSeeded(database);
      const row = database
        .prepare(
          "SELECT content_json FROM gold_curriculum_records WHERE record_id LIKE 'ohio-%' ORDER BY record_id LIMIT 1",
        )
        .get() as { content_json: string };
      const content = JSON.parse(row.content_json) as Record<string, unknown>;
      expect(typeof content.standardCode).toBe("string");
      expect(typeof content.standardText).toBe("string");
      expect(typeof content.domain).toBe("string");
    } finally {
      database.close();
    }
  });
});
