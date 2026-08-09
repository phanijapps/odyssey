import { type CurriculumRecord, parseCurriculumRecord } from "./curriculum-model";

const STANDARD_LINE = /^(?:\(\+\)\s*)?([A-Z0-9]+\.[A-Z]{1,3}\.[0-9]+)\s+(.+)$/;

/** Imports only explicit Ohio standard lines from a reviewed PDF page extraction. */
export function importOhioMathPage(input: {
  readonly page: number;
  readonly gradeOrCourse: string;
  readonly domain: string;
  readonly cluster: string;
  readonly text: string;
}): CurriculumRecord[] {
  const records: Array<{ code: string; text: string }> = [];
  for (const line of input.text.split("\n").map((value) => value.trim())) {
    const match = line.match(STANDARD_LINE);
    if (match) {
      records.push({ code: match[1], text: match[2] });
      continue;
    }
    if (line && records.length > 0) records.at(-1)!.text += ` ${line}`;
  }
  return records.map(({ code, text }) =>
    parseCurriculumRecord({
      id: `ohio-math-2017:${code.toLowerCase()}`,
      subject: "mathematics",
      framework: "ohio-learning-standards-2017",
      gradeOrCourse: input.gradeOrCourse,
      domain: input.domain,
      cluster: input.cluster,
      standardCode: code,
      standardText: text,
      source: { documentId: "ohio-math-2017", page: input.page },
      topics: [],
      assessmentTargets: [],
    }),
  );
}
