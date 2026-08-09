import "server-only";
import { createHash } from "node:crypto";
import type { CurriculumRecord } from "../../../../packages/curriculum/src/curriculum-model";

export const MAX_CURRICULUM_UPLOAD_BYTES = 10 * 1024 * 1024;

export type CurriculumUploadFormat = "pdf" | "json" | "csv" | "text";

/** Safe metadata for a locally submitted source; raw bytes stay in the workflow store. */
export type CurriculumUpload = {
  readonly fileName: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly format: CurriculumUploadFormat;
  readonly fingerprint: string;
  readonly warnings: readonly string[];
};

/** Identifies a curriculum source without coupling the core to its format. */
export type CurriculumSourceDocument = {
  readonly id: string;
  readonly fingerprint: string;
  readonly format: CurriculumUploadFormat | "api";
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

/** Validates one supported local source and produces metadata safe for steward review. */
export function validateCurriculumUpload(input: {
  readonly name: string;
  readonly type: string;
  readonly bytes: Uint8Array;
}): CurriculumUpload {
  const fileName = input.name.trim();
  if (!fileName || input.bytes.byteLength === 0)
    throw new Error("Empty curriculum upload");
  if (input.bytes.byteLength > MAX_CURRICULUM_UPLOAD_BYTES)
    throw new Error("Curriculum upload exceeds 10 MiB");
  const format = getUploadFormat(fileName, input.type);
  if (!format) throw new Error("Unsupported curriculum upload");
  return {
    fileName,
    mimeType: input.type || "application/octet-stream",
    byteSize: input.bytes.byteLength,
    format,
    fingerprint: createHash("sha256").update(input.bytes).digest("hex"),
    warnings: input.type ? [] : ["File type was inferred from its extension."],
  };
}

function getUploadFormat(
  fileName: string,
  mimeType: string,
): CurriculumUploadFormat | null {
  const extension = fileName.toLowerCase().split(".").at(-1);
  const byExtension: Record<string, CurriculumUploadFormat> = {
    pdf: "pdf",
    csv: "csv",
    json: "json",
    txt: "text",
  };
  const byMime: Record<string, CurriculumUploadFormat> = {
    "application/pdf": "pdf",
    "text/csv": "csv",
    "application/json": "json",
    "text/plain": "text",
  };
  const format = byExtension[extension ?? ""];
  if (!format || (mimeType && byMime[mimeType] && byMime[mimeType] !== format))
    return null;
  return format;
}
