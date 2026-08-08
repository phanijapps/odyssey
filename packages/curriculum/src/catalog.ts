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
  throw new Error("STUB: implement strict curriculum catalog parsing");
}
