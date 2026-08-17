import { expect, test } from "vitest";
import { findStandardByTopicId } from "./practice-target";
import type { FlatStandard } from "./types";

const standard: FlatStandard = {
  id: "gold-1",
  standardCode: "8.EE.7",
  standardText: "Use linear equations.",
  domain: "Expressions",
  subject: "Mathematics",
  grade: "Grade 8",
};

test("resolves an exact composed topic identity to its reviewed standard", () => {
  expect(
    findStandardByTopicId(
      [standard],
      "Mathematics::Grade 8::Expressions::8.EE.7",
    ),
  ).toEqual(standard);
});

test("returns null for stale, malformed, or non-matching targets", () => {
  expect(findStandardByTopicId([standard], "Mathematics::Grade 8")).toBeNull();
  expect(
    findStandardByTopicId(
      [standard],
      "Mathematics::Grade 8::Expressions::8.EE.1",
    ),
  ).toBeNull();
  expect(
    findStandardByTopicId(
      [standard],
      "Mathematics::Grade 8::Expressions::8.EE.7::extra",
    ),
  ).toBeNull();
  expect(findStandardByTopicId([standard], "")).toBeNull();
  expect(
    findStandardByTopicId([], "Mathematics::Grade 8::Expressions::8.EE.7"),
  ).toBeNull();
});
