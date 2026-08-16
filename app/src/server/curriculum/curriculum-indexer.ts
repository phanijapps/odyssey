import "server-only";
import { createHash } from "node:crypto";
import type { CurriculumRecord } from "./curriculum-model";
import {
  OLLAMA_EMBEDDING_MODEL,
  embedCurriculumText,
} from "./ollama-embeddings";
import { type CurriculumVectorRepository } from "./vector-repository";

/** Embeds source-backed records without changing their official content. */
export async function indexCurriculumRecords(
  records: readonly CurriculumRecord[],
  repository: CurriculumVectorRepository,
  embed = embedCurriculumText,
): Promise<number> {
  for (const record of records) {
    const content = [
      record.subject,
      record.gradeOrCourse,
      record.domain,
      record.cluster,
      record.standardCode,
      record.standardText,
    ].join("\n");
    repository.save({
      recordId: record.id,
      subject: record.subject,
      framework: record.framework,
      model: OLLAMA_EMBEDDING_MODEL,
      contentFingerprint: createHash("sha256").update(content).digest("hex"),
      vector: await embed(content),
    });
  }
  return records.length;
}
