import "server-only";
import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { withGoldDatabase } from "./gold-database";
import { CurriculumVectorRepository } from "./vector-repository";

export type GoldRecordSummary = {
  readonly id: string;
  readonly subject: string;
  readonly framework: string;
  readonly gradeOrCourse: string;
  readonly domain: string;
  readonly cluster: string;
  readonly standardCode: string;
  readonly standardText: string;
  readonly topics: readonly string[];
  readonly source: { readonly documentId: string; readonly page: number };
};

export type GoldStats = {
  readonly totalRecords: number;
  readonly subjects: readonly {
    readonly subject: string;
    readonly count: number;
  }[];
  readonly grades: readonly {
    readonly grade: string;
    readonly count: number;
  }[];
  readonly domains: readonly {
    readonly domain: string;
    readonly count: number;
  }[];
  readonly sources: readonly {
    readonly source: string;
    readonly count: number;
  }[];
};

/** Parses a content_json row into a GoldRecordSummary. */
function parseGoldRow(row: { content_json: string }): GoldRecordSummary | null {
  try {
    const data = JSON.parse(row.content_json);
    return {
      id: data.id ?? "unknown",
      subject: data.subject ?? "unknown",
      framework: data.framework ?? "unknown",
      gradeOrCourse: data.gradeOrCourse ?? "unknown",
      domain: data.domain ?? "unknown",
      cluster: data.cluster ?? "",
      standardCode: data.standardCode ?? "",
      standardText: data.standardText ?? "",
      topics: Array.isArray(data.topics) ? data.topics : [],
      source: data.source ?? { documentId: "unknown", page: 0 },
    };
  } catch {
    return null;
  }
}

/** Lists Gold records with optional filters. */
export function listGoldRecords(filter?: {
  readonly subject?: string;
  readonly grade?: string;
  readonly domain?: string;
  readonly topic?: string;
  readonly search?: string;
  readonly limit?: number;
}): GoldRecordSummary[] {
  return withGoldDatabase((db) => {
    let sql = "SELECT record_id, content_json FROM gold_curriculum_records";
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filter?.subject) {
      conditions.push("subject = ?");
      params.push(filter.subject);
    }
    if (filter?.grade) {
      conditions.push("content_json LIKE ?");
      params.push(`%"gradeOrCourse":"${filter.grade}"%`);
    }
    if (filter?.domain) {
      conditions.push("content_json LIKE ?");
      params.push(`%"domain":"${filter.domain}"%`);
    }
    if (filter?.topic) {
      conditions.push("content_json LIKE ?");
      params.push(`%"${filter.topic}"%`);
    }
    if (filter?.search) {
      conditions.push("(content_json LIKE ? OR content_json LIKE ?)");
      params.push(`%${filter.search}%`);
      params.push(`%${filter.search}%`);
    }
    if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");

    sql += " ORDER BY created_at DESC";
    const limit = Math.min(filter?.limit ?? 500, 1000);
    sql += ` LIMIT ${limit}`;

    const rows = db.prepare(sql).all(...params) as Array<{
      record_id: string;
      content_json: string;
    }>;

    return rows
      .map((row) => parseGoldRow({ content_json: row.content_json }))
      .filter((r): r is GoldRecordSummary => r !== null);
  });
}

/** Returns aggregate statistics about Gold records. */
export function getGoldStats(): GoldStats {
  return withGoldDatabase((db) => {
    const rows = db
      .prepare("SELECT content_json FROM gold_curriculum_records")
      .all() as Array<{ content_json: string }>;

    const records = rows
      .map(parseGoldRow)
      .filter((r): r is GoldRecordSummary => r !== null);

    const countBy = (key: keyof GoldRecordSummary) => {
      const map = new Map<string, number>();
      for (const r of records) {
        const val = String(r[key]);
        map.set(val, (map.get(val) ?? 0) + 1);
      }
      return [...map.entries()]
        .map(([k, v]) => ({ key: k, count: v }))
        .sort((a, b) => b.count - a.count);
    };

    const sourceMap = new Map<string, number>();
    for (const r of records) {
      const src = r.source.documentId;
      sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1);
    }

    return {
      totalRecords: records.length,
      subjects: countBy("subject").map((s) => ({
        subject: s.key,
        count: s.count,
      })),
      grades: countBy("gradeOrCourse").map((g) => ({
        grade: g.key,
        count: g.count,
      })),
      domains: countBy("domain")
        .slice(0, 20)
        .map((d) => ({ domain: d.key, count: d.count })),
      sources: [...sourceMap.entries()]
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count),
    };
  });
}

/** Returns all distinct topic tags across Gold records. */
export function getGoldTopics(): {
  readonly topic: string;
  readonly count: number;
}[] {
  return withGoldDatabase((db) => {
    const rows = db
      .prepare("SELECT content_json FROM gold_curriculum_records")
      .all() as Array<{ content_json: string }>;

    const topicMap = new Map<string, number>();
    for (const row of rows) {
      const parsed = parseGoldRow({ content_json: row.content_json });
      if (parsed) {
        for (const topic of parsed.topics) {
          topicMap.set(topic, (topicMap.get(topic) ?? 0) + 1);
        }
      }
    }
    return [...topicMap.entries()]
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count);
  });
}

/** Deletes a single Gold record by id. */
export function deleteGoldRecord(recordId: string): boolean {
  return withGoldDatabase(
    (db) => deleteGoldRecords(db, "record_id = ?", [recordId]) > 0,
  );
}

/** Deletes all Gold records from a specific source file. */
export function deleteGoldBySource(sourceFingerprint: string): number {
  return withGoldDatabase((db) =>
    deleteGoldRecords(db, "source_fingerprint = ?", [sourceFingerprint]),
  );
}

/** Removes Gold rows and makes their vector projections unreachable together. */
function deleteGoldRecords(
  db: DatabaseSync,
  condition: string,
  parameters: readonly string[],
): number {
  const recordIds = db
    .prepare(`SELECT record_id FROM gold_curriculum_records WHERE ${condition}`)
    .all(...parameters) as Array<{ record_id: string }>;
  if (!recordIds.length) return 0;

  let vectors: CurriculumVectorRepository | null = null;
  try {
    vectors = new CurriculumVectorRepository(db);
  } catch {
    // A host without sqlite-vec cannot serve semantic retrieval. Removing the
    // metadata still prevents any old vector row from resolving to Gold.
  }

  const hasEmbeddingRecords = Boolean(
    db
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'curriculum_embedding_records'",
      )
      .get(),
  );
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = db
      .prepare(`DELETE FROM gold_curriculum_records WHERE ${condition}`)
      .run(...parameters);
    for (const { record_id: recordId } of recordIds) {
      if (vectors) vectors.remove(recordId);
      else if (hasEmbeddingRecords)
        db.prepare(
          "DELETE FROM curriculum_embedding_records WHERE record_id = ?",
        ).run(recordId);
    }
    db.exec("COMMIT");
    return result.changes as number;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/** A reviewed Gold record frozen into a server-owned assessment selection. */
export type ResolvedGoldRecord = {
  readonly recordId: string;
  readonly subject: string;
  readonly grade: string;
  readonly content: GoldRecordSummary;
  readonly contentJson: string;
  readonly contentFingerprint: string;
};

/**
 * Resolves selected opaque Gold primary keys without traversing the browse tree.
 * The returned JSON is the exact reviewed content that an assessment snapshots.
 */
export function resolveGoldRecordsForAssessment(
  recordIds: readonly string[],
): ResolvedGoldRecord[] {
  if (
    recordIds.length < 1 ||
    recordIds.length > 3 ||
    recordIds.some((id) => !id || !id.trim()) ||
    new Set(recordIds).size !== recordIds.length
  )
    throw new Error("Invalid selected Gold records");

  return withGoldDatabase((db) => {
    const placeholders = recordIds.map(() => "?").join(", ");
    const rows = db
      .prepare(
        `SELECT record_id, content_json
         FROM gold_curriculum_records
         WHERE record_id IN (${placeholders})`,
      )
      .all(...recordIds) as Array<{ record_id: string; content_json: string }>;
    if (rows.length !== recordIds.length)
      throw new Error("Invalid selected Gold records");

    const recordsById = new Map<string, ResolvedGoldRecord>();
    for (const row of rows) {
      const content = parseGoldRow({ content_json: row.content_json });
      if (
        !content ||
        !content.subject.toLowerCase().includes("math") ||
        !content.gradeOrCourse ||
        content.gradeOrCourse === "unknown"
      )
        throw new Error("Invalid selected Gold records");
      recordsById.set(row.record_id, {
        recordId: row.record_id,
        subject: content.subject,
        grade: content.gradeOrCourse,
        content,
        contentJson: row.content_json,
        contentFingerprint: createHash("sha256")
          .update(row.content_json)
          .digest("hex"),
      });
    }

    const ordered = recordIds.map((id) => recordsById.get(id));
    if (ordered.some((record) => !record))
      throw new Error("Invalid selected Gold records");
    const selected = ordered as ResolvedGoldRecord[];
    if (
      selected.some(
        (record) =>
          record.subject !== selected[0].subject ||
          record.grade !== selected[0].grade,
      )
    )
      throw new Error("Invalid selected Gold records");
    return selected;
  });
}
