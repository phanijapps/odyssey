/** A source location that makes an official curriculum statement auditable. */
export type CurriculumSource = {
  readonly documentId: string;
  readonly page: number;
};

/** An official standard plus application-owned teaching and assessment links. */
export type CurriculumRecord = {
  readonly id: string;
  readonly subject: string;
  readonly framework: string;
  readonly gradeOrCourse: string;
  readonly domain: string;
  readonly cluster: string;
  readonly standardCode: string;
  readonly standardText: string;
  readonly source: CurriculumSource;
  readonly topics: readonly string[];
  readonly assessmentTargets: readonly string[];
};

/** Parses a complete, source-backed curriculum record without accepting extra fields. */
export function parseCurriculumRecord(input: unknown): CurriculumRecord {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Invalid curriculum record");
  const record = input as Record<string, unknown>;
  const keys = [
    "id",
    "subject",
    "framework",
    "gradeOrCourse",
    "domain",
    "cluster",
    "standardCode",
    "standardText",
    "source",
    "topics",
    "assessmentTargets",
  ];
  if (
    Object.keys(record).length !== keys.length ||
    keys.some((key) => !(key in record)) ||
    keys.some(
      (key) =>
        key !== "source" &&
        key !== "topics" &&
        key !== "assessmentTargets" &&
        (typeof record[key] !== "string" || !(record[key] as string).trim()),
    ) ||
    !Array.isArray(record.topics) ||
    !record.topics.every((topic) => typeof topic === "string" && topic.length > 0) ||
    !Array.isArray(record.assessmentTargets) ||
    !record.assessmentTargets.every(
      (target) => typeof target === "string" && target.length > 0,
    ) ||
    !isCurriculumSource(record.source)
  )
    throw new Error("Invalid curriculum record");
  return record as unknown as CurriculumRecord;
}

function isCurriculumSource(input: unknown): input is CurriculumSource {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const source = input as Record<string, unknown>;
  return (
    Object.keys(source).length === 2 &&
    typeof source.documentId === "string" &&
    source.documentId.length > 0 &&
    Number.isInteger(source.page) &&
    Number(source.page) > 0
  );
}
