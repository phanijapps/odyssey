import { expect, test } from "vitest";
import { importOhioMathPage } from "./ohio-math-import";

test("imports explicit Ohio standard codes with their source page", () => {
  expect(
    importOhioMathPage({
      page: 41,
      gradeOrCourse: "Grade 6",
      domain: "Ratios and Proportional Relationships",
      cluster: "Understand ratio concepts and use ratio reasoning to solve problems.",
      text: `6.RP.1 Understand the concept of a ratio and use ratio language to
describe a ratio relationship between two quantities.
6.RP.2 Understand the concept of a unit rate.`,
    }),
  ).toEqual([
    expect.objectContaining({
      standardCode: "6.RP.1",
      source: expect.objectContaining({ page: 41 }),
    }),
    expect.objectContaining({ standardCode: "6.RP.2" }),
  ]);
});

test("does not invent a standard from prose without an official code", () => {
  expect(
    importOhioMathPage({
      page: 41,
      gradeOrCourse: "Grade 6",
      domain: "Ratios",
      cluster: "Ratio reasoning",
      text: "Students reason about ratios in daily life.",
    }),
  ).toEqual([]);
});
