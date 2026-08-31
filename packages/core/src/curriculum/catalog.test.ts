import { expect, test } from "vitest";
import { parseCurriculumCatalog } from "./catalog";

test("parses a reviewed catalog record with its Ohio source trace", () => {
  expect(
    parseCurriculumCatalog({
      revision: "2026-08-08",
      topics: [
        {
          id: "ratio",
          standardId: "6.RP.A.1",
          gradeOrCourse: "6",
          title: "Ratios",
          sourceUrl: "https://education.ohio.gov/example",
        },
      ],
    }),
  ).toMatchObject({
    revision: "2026-08-08",
    topics: [{ standardId: "6.RP.A.1" }],
  });
});

test("rejects unknown catalog fields", () => {
  expect(() =>
    parseCurriculumCatalog({ revision: "v1", topics: [], extra: true }),
  ).toThrow();
});
