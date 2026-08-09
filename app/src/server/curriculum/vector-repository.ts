import "server-only";
import { DatabaseSync } from "node:sqlite";
import { load } from "sqlite-vec";

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
    database.exec(`
      CREATE TABLE IF NOT EXISTS curriculum_embedding_records (
        id INTEGER PRIMARY KEY, record_id TEXT UNIQUE NOT NULL, subject TEXT NOT NULL,
        framework TEXT NOT NULL, model TEXT NOT NULL, dimension INTEGER NOT NULL,
        content_fingerprint TEXT NOT NULL
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS curriculum_embedding_vectors
      USING vec0(embedding float[768]);
    `);
  }

  save(input: CurriculumEmbedding): void {
    if (input.vector.length !== EMBEDDING_DIMENSION)
      throw new Error("Invalid embedding dimension");
    this.database.prepare(
      `INSERT INTO curriculum_embedding_records
      (record_id, subject, framework, model, dimension, content_fingerprint)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(record_id) DO UPDATE SET subject=excluded.subject,
      framework=excluded.framework, model=excluded.model, dimension=excluded.dimension,
      content_fingerprint=excluded.content_fingerprint`,
    ).run(input.recordId, input.subject, input.framework, input.model, EMBEDDING_DIMENSION, input.contentFingerprint);
    const record = this.database.prepare("SELECT id FROM curriculum_embedding_records WHERE record_id = ?").get(input.recordId) as { id: number };
    this.database.prepare("DELETE FROM curriculum_embedding_vectors WHERE rowid = ?").run(BigInt(record.id));
    this.database.prepare("INSERT INTO curriculum_embedding_vectors(rowid, embedding) VALUES (?, ?)").run(BigInt(record.id), JSON.stringify(input.vector));
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
