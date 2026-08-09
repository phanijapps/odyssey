import "server-only";
import type { CurriculumRecord } from "../../../../packages/curriculum/src/curriculum-model";

/** Identifies a curriculum source without coupling the core to its format. */
export type CurriculumSourceDocument = {
  readonly id: string;
  readonly fingerprint: string;
  readonly format: "pdf" | "json" | "csv" | "api";
};

/** Converts one external curriculum source into validated canonical records. */
export type CurriculumSourceParser = {
  parse(
    document: CurriculumSourceDocument,
  ): Promise<readonly CurriculumRecord[]>;
};

/** Imports records from any reviewed source adapter into a caller-owned index. */
export async function importCurriculumSource(
  document: CurriculumSourceDocument,
  parser: CurriculumSourceParser,
  index: (records: readonly CurriculumRecord[]) => Promise<number>,
): Promise<number> {
  if (!document.id || !document.fingerprint)
    throw new Error("Invalid curriculum source");
  return index(await parser.parse(document));
}
