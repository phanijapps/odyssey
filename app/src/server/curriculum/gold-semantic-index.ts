import "server-only";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { CurriculumRecord } from "../../../../packages/curriculum/src/curriculum-model";
import {
  OLLAMA_EMBEDDING_MODEL,
  embedCurriculumText,
} from "./ollama-embeddings";
import {
  type CurriculumRelation,
  writeGoldCurriculumGraph,
} from "./engram-curriculum-graph";
import queries from "./sqlite-queries.json";
import { CurriculumVectorRepository } from "./vector-repository";

type GoldPersistenceInput = {
  readonly canonicalRecords: readonly CurriculumRecord[];
  readonly relations: readonly CurriculumRelation[];
  readonly sourceFingerprint: string;
  readonly promptVersion: string;
  readonly model: string;
};

type GoldIndexDependencies = {
  readonly database: DatabaseSync;
  readonly writeGraph?: (
    records: readonly CurriculumRecord[],
    relations: readonly CurriculumRelation[],
  ) => Promise<boolean>;
  readonly embed?: (text: string) => Promise<readonly number[]>;
};

/** Persists canonical Gold, projects its graph, and indexes its local vectors. */
export class GoldSemanticIndex {
  private readonly vectors: CurriculumVectorRepository;
  private readonly writeGraph: NonNullable<GoldIndexDependencies["writeGraph"]>;
  private readonly embed: NonNullable<GoldIndexDependencies["embed"]>;

  private readonly vectorsAvailable: boolean;

  constructor(private readonly dependencies: GoldIndexDependencies) {
    dependencies.database.exec(queries.initializeGoldRecords);
    let vectors: CurriculumVectorRepository | null = null;
    try {
      vectors = new CurriculumVectorRepository(dependencies.database);
    } catch {
      // sqlite-vec may not load under some build environments
    }
    this.vectors = vectors as CurriculumVectorRepository;
    this.vectorsAvailable = vectors !== null;
    this.writeGraph = dependencies.writeGraph ?? writeGoldCurriculumGraph;
    this.embed = dependencies.embed ?? embedCurriculumText;
  }

  async persist(input: GoldPersistenceInput): Promise<{
    recordCount: number;
    graphProjected: boolean;
  }> {
    if (
      !input.canonicalRecords.length ||
      !input.sourceFingerprint ||
      !input.promptVersion
    )
      throw new Error("Invalid Gold semantic index input");
    const graphProjected = await this.writeGraph(
      input.canonicalRecords,
      input.relations,
    );
    this.dependencies.database.exec(queries.beginTransaction);
    try {
      for (const record of input.canonicalRecords) {
        this.dependencies.database
          .prepare(queries.upsertGoldRecord)
          .run(
            record.id,
            record.subject,
            record.framework,
            JSON.stringify(record),
            input.sourceFingerprint,
            input.promptVersion,
            input.model,
            new Date().toISOString(),
          );
        if (this.vectorsAvailable) {
          try {
            const content = recordContent(record);
            this.vectors?.save({
              recordId: record.id,
              subject: record.subject,
              framework: record.framework,
              model: OLLAMA_EMBEDDING_MODEL,
              contentFingerprint: createHash("sha256")
                .update(content)
                .digest("hex"),
              vector: await this.embed(content),
            });
          } catch {
            // Vector embedding may fail if sqlite-vec or Ollama is unavailable;
            // the Gold record is still persisted in the relational table.
          }
        }
      }
      this.dependencies.database.exec(queries.commitTransaction);
    } catch (error) {
      this.dependencies.database.exec(queries.rollbackTransaction);
      throw error;
    }
    return {
      recordCount: input.canonicalRecords.length,
      graphProjected,
    };
  }
}

/** Opens the local durable Gold database used by the one-port application. */
export function createLocalGoldSemanticIndex(): GoldSemanticIndex {
  return new GoldSemanticIndex({
    database: new DatabaseSync(
      process.env.ODYSSEY_CURRICULUM_DB_PATH ?? "odyssey-curriculum.db",
      { allowExtension: true },
    ),
  });
}

function recordContent(record: CurriculumRecord): string {
  return [
    record.subject,
    record.gradeOrCourse,
    record.domain,
    record.cluster,
    record.standardCode,
    record.standardText,
  ].join("\n");
}
