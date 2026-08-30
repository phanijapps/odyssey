import "server-only";
import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import queries from "./sqlite-queries.json";
import ohioCatalog from "./data/ohio-catalog.json";

/** One reviewed catalog record as it ships in the versioned JSON. */
type CatalogRecord = {
  readonly recordId: string;
  readonly subject: string;
  readonly framework: string;
  readonly content: Record<string, unknown>;
  readonly sourceFingerprint: string;
  readonly promptVersion: string;
  readonly model: string;
  readonly createdAt: string;
};

type ReviewedCatalog = {
  readonly revision: string;
  readonly records: readonly CatalogRecord[];
};

/** Parses only strict, reviewed catalog-seed data. */
function parseReviewedCatalog(input: unknown): ReviewedCatalog {
  if (
    !input ||
    typeof input !== "object" ||
    typeof (input as { revision?: unknown }).revision !== "string" ||
    !Array.isArray((input as { records?: unknown }).records)
  )
    throw new Error("Invalid reviewed catalog");
  const records = (input as { records: unknown[] }).records.map((record) => {
    if (!record || typeof record !== "object")
      throw new Error("Invalid reviewed catalog record");
    const row = record as Record<string, unknown>;
    const keys = [
      "recordId",
      "subject",
      "framework",
      "content",
      "sourceFingerprint",
      "promptVersion",
      "model",
      "createdAt",
    ];
    if (
      Object.keys(row).some((key) => !keys.includes(key)) ||
      keys
        .filter((key) => key !== "content")
        .some((key) => typeof row[key] !== "string") ||
      !row.content ||
      typeof row.content !== "object"
    )
      throw new Error("Invalid reviewed catalog record");
    return row as unknown as CatalogRecord;
  });
  return { revision: (input as { revision: string }).revision, records };
}

const CATALOG_FILE_BYTES = JSON.stringify(ohioCatalog);

const parsedCatalog: ReviewedCatalog = parseReviewedCatalog(ohioCatalog);

const CATALOG_CONTENT_HASH = createHash("sha256")
  .update(CATALOG_FILE_BYTES, "utf8")
  .digest("hex");

/**
 * Seeds the reviewed catalog into the Gold store. Idempotent and additive:
 * a content-hash guard makes steady-state runs a single SELECT, upserts key
 * on record_id, and records already present in the database but absent from
 * the JSON are never deleted.
 */
export function ensureCatalogSeeded(database: DatabaseSync): void {
  const meta = database
    .prepare("SELECT content_hash FROM catalog_seed_meta WHERE id = 1")
    .get() as { content_hash: string } | undefined;
  if (meta?.content_hash === CATALOG_CONTENT_HASH) return;

  const upsert = database.prepare(queries.upsertGoldRecord);
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const record of parsedCatalog.records) {
      upsert.run(
        record.recordId,
        record.subject,
        record.framework,
        JSON.stringify(record.content),
        record.sourceFingerprint,
        record.promptVersion,
        record.model,
        record.createdAt,
      );
    }
    database
      .prepare(
        `INSERT INTO catalog_seed_meta (id, content_hash, seeded_at)
         VALUES (1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET content_hash = excluded.content_hash, seeded_at = excluded.seeded_at`,
      )
      .run(CATALOG_CONTENT_HASH, new Date().toISOString());
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

/** Exposed for tests: the number of records the reviewed catalog carries. */
export function reviewedCatalogSize(): number {
  return parsedCatalog.records.length;
}
