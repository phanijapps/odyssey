import { expect, test } from "vitest";
import { parseCurriculumRecord } from "./curriculum-model";

test("accepts a source-backed standard and its teaching targets", () => {
  expect(
    parseCurriculumRecord({
      id: "ohio-math-2017:6:rp:1",
      subject: "mathematics",
      framework: "ohio-learning-standards-2017",
      gradeOrCourse: "Grade 6",
      domain: "Ratios and Proportional Relationships",
      cluster: "Understand ratio concepts",
      standardCode: "6.RP.A.1",
      standardText: "Understand the concept of a ratio.",
      source: { documentId: "ohio-math-2017", page: 39 },
      topics: ["ratio-concepts"],
      assessmentTargets: ["identify-ratios"],
    }),
  ).toMatchObject({ standardCode: "6.RP.A.1", topics: ["ratio-concepts"] });
});

test("rejects a record without traceable source or hierarchy", () => {
  expect(() => parseCurriculumRecord({ subject: "mathematics" })).toThrow(
    "Invalid curriculum record",
  );
});
