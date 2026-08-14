import "server-only";
import { DatabaseSync } from "node:sqlite";

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

/** Opens the Gold curriculum database. */
function goldDb(): DatabaseSync {
  return new DatabaseSync(
    process.env.ODYSSEY_CURRICULUM_DB_PATH ?? "odyssey-curriculum.db",
  );
}

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
  const db = goldDb();
  try {
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
  } finally {
    db.close();
  }
}

/** Returns aggregate statistics about Gold records. */
export function getGoldStats(): GoldStats {
  const db = goldDb();
  try {
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
  } finally {
    db.close();
  }
}

/** Returns all distinct topic tags across Gold records. */
export function getGoldTopics(): {
  readonly topic: string;
  readonly count: number;
}[] {
  const db = goldDb();
  try {
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
  } finally {
    db.close();
  }
}

/** Deletes a single Gold record by id. */
export function deleteGoldRecord(recordId: string): boolean {
  const db = goldDb();
  try {
    const result = db
      .prepare("DELETE FROM gold_curriculum_records WHERE record_id = ?")
      .run(recordId);
    return (result.changes as number) > 0;
  } finally {
    db.close();
  }
}

/** Deletes all Gold records from a specific source file. */
export function deleteGoldBySource(sourceFingerprint: string): number {
  const db = goldDb();
  try {
    const result = db
      .prepare(
        "DELETE FROM gold_curriculum_records WHERE source_fingerprint = ?",
      )
      .run(sourceFingerprint);
    return result.changes as number;
  } finally {
    db.close();
  }
}
