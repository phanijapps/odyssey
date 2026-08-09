import { expect, test } from "vitest";
import type { CurriculumRecord } from "../../../../packages/curriculum/src/curriculum-model";
import { importCurriculumSource } from "./source-importer";

test("imports any source adapter output into the canonical index", async () => {
  const record: CurriculumRecord = {
    id: "example:standard-1",
    subject: "example-subject",
    framework: "example-framework",
    gradeOrCourse: "Course A",
    domain: "Domain",
    cluster: "Cluster",
    standardCode: "S.1",
    standardText: "Demonstrate the skill.",
    source: { documentId: "example-document", page: 1 },
    topics: ["skill"],
    assessmentTargets: ["demonstrate-skill"],
  };
  await expect(
    importCurriculumSource(
      { id: "example-document", fingerprint: "abc", format: "json" },
      { parse: async () => [record] },
      async (records) => records.length,
    ),
  ).resolves.toBe(1);
});

test("rejects an unidentifiable source before an adapter runs", async () => {
  await expect(
    importCurriculumSource(
      { id: "", fingerprint: "abc", format: "pdf" },
      { parse: async () => [] },
      async () => 0,
    ),
  ).rejects.toThrow("Invalid curriculum source");
});
