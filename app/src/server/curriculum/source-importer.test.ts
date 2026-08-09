import { expect, test } from "vitest";
import type { CurriculumRecord } from "../../../../packages/curriculum/src/curriculum-model";
import {
  importCurriculumSource,
  validateCurriculumUpload,
} from "./source-importer";

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

test("validates a local text upload without persisting its bytes", () => {
  const upload = validateCurriculumUpload({
    name: "district-framework.txt",
    type: "text/plain",
    bytes: new TextEncoder().encode("Grade 6 ratios"),
  });

  expect(upload).toMatchObject({
    fileName: "district-framework.txt",
    mimeType: "text/plain",
    byteSize: 14,
    format: "text",
    warnings: [],
  });
  expect(upload.fingerprint).toMatch(/^[a-f0-9]{64}$/);
});

test("rejects empty, oversized, and unsupported local uploads", () => {
  expect(() =>
    validateCurriculumUpload({
      name: "notes.docx",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes: new Uint8Array([1]),
    }),
  ).toThrow("Unsupported curriculum upload");
  expect(() =>
    validateCurriculumUpload({
      name: "empty.csv",
      type: "text/csv",
      bytes: new Uint8Array(),
    }),
  ).toThrow("Empty curriculum upload");
  expect(() =>
    validateCurriculumUpload({
      name: "large.json",
      type: "application/json",
      bytes: new Uint8Array(10 * 1024 * 1024 + 1),
    }),
  ).toThrow("Curriculum upload exceeds 10 MiB");
});
