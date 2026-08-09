import "server-only";
import { DatabaseSync } from "node:sqlite";
import { load } from "sqlite-vec";
import queries from "./sqlite-queries.json";

const EMBEDDING_DIMENSION = 768;

export type CurriculumEmbedding = {
  readonly recordId: string;
  readonly subject: string;
  readonly framework: string;
  readonly model: string;
  readonly contentFingerprint: string;
  readonly vector: readonly number[];
};

/** Stores curriculum embeddings and retrieves nearest source records locally. */
export class CurriculumVectorRepository {
  constructor(private readonly database: DatabaseSync) {
    loadVectorExtension(database);
    database.exec(`${queries.initializeRecords};${queries.initializeVectors};`);
  }

  save(input: CurriculumEmbedding): void {
    if (input.vector.length !== EMBEDDING_DIMENSION)
      throw new Error("Invalid embedding dimension");
    this.database
      .prepare(queries.upsertRecord)
      .run(
        input.recordId,
        input.subject,
        input.framework,
        input.model,
        EMBEDDING_DIMENSION,
        input.contentFingerprint,
      );
    const record = this.database
      .prepare(queries.findRecordId)
      .get(input.recordId) as { id: number };
    this.database.prepare(queries.deleteVector).run(BigInt(record.id));
    this.database
      .prepare(queries.insertVector)
      .run(BigInt(record.id), JSON.stringify(input.vector));
  }

  /** Finds the closest source records within one reviewed curriculum framework. */
  findNearest(input: {
    readonly vector: readonly number[];
    readonly subject: string;
    readonly framework: string;
    readonly limit: number;
  }): Array<{ recordId: string; distance: number }> {
    if (input.vector.length !== EMBEDDING_DIMENSION)
      throw new Error("Invalid embedding dimension");
    const limit = Math.min(Math.max(input.limit, 1), 20);
    const candidates = this.database
      .prepare(queries.nearestVectors)
      .all(JSON.stringify(input.vector), 50) as Array<{
      rowid: number;
      distance: number;
    }>;
    return candidates
      .flatMap((candidate) => {
        const record = this.database
          .prepare(queries.scopedRecord)
          .get(candidate.rowid, input.subject, input.framework) as
          | { record_id: string }
          | undefined;
        return record
          ? [{ recordId: record.record_id, distance: candidate.distance }]
          : [];
      })
      .slice(0, limit);
  }
}

function loadVectorExtension(database: DatabaseSync): void {
  database.enableLoadExtension(true);
  try {
    load(database);
  } finally {
    database.enableLoadExtension(false);
  }
}
