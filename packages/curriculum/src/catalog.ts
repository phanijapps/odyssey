/** A reviewed Ohio-aligned catalog record. */
export type CurriculumCatalog = {
  readonly revision: string;
  readonly topics: readonly CurriculumTopic[];
};

/** A selectable topic and its source trace. */
export type CurriculumTopic = {
  readonly id: string;
  readonly standardId: string;
  readonly gradeOrCourse: string;
  readonly title: string;
  readonly sourceUrl: string;
};

/** Parses only strict, reviewed curriculum catalog data. */
export function parseCurriculumCatalog(_input: unknown): CurriculumCatalog {
  if (!_input || typeof _input !== "object") throw new Error("Invalid catalog");
  const input = _input as Record<string, unknown>;
  if (
    Object.keys(input).some((key) => !["revision", "topics"].includes(key)) ||
    typeof input.revision !== "string" ||
    !Array.isArray(input.topics)
  )
    throw new Error("Invalid catalog");
  const topics = input.topics.map((topic) => {
    if (!topic || typeof topic !== "object") throw new Error("Invalid topic");
    const record = topic as Record<string, unknown>;
    const keys = ["id", "standardId", "gradeOrCourse", "title", "sourceUrl"];
    if (
      Object.keys(record).some((key) => !keys.includes(key)) ||
      keys.some((key) => typeof record[key] !== "string")
    )
      throw new Error("Invalid topic");
    return record as unknown as CurriculumTopic;
  });
  return { revision: input.revision, topics };
}
