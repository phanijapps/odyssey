import { expect, test } from "vitest";
import { serializeSafeDiagnostic, validateLearningPayload } from "./payloads";

// STUB: AC7

test("STUB: AC7 accepts the approved SVG and app-owned A2UI payload", () => {
  expect(() =>
    validateLearningPayload({ component: "GeometryDiagram", diagramSvg: "<svg aria-label=\"triangle\" />" }),
  ).not.toThrow();
});

// STUB: AC9
test("STUB: AC9 rejects untyped input before persistence or rendering", () => {
  for (const payload of [
    { diagramSvg: "<script />" },
    { diagramSvg: '<svg><a href="https://example.invalid" /></svg>' },
    { diagramSvg: '<svg onload="alert(1)" />' },
    { component: "Unknown" },
    { component: "GeometryDiagram", unexpected: true },
    { tool: "unregistered-action" },
    { rawHtml: "<img src=x onerror=alert(1)>" },
    { serialized: '{"__proto__":{"polluted":true}}' },
  ]) {
    expect(() => validateLearningPayload(payload)).toThrow();
  }
});

// STUB: AC14
test("STUB: AC14 redacts every forbidden value from logs, client errors, and audit records", () => {
  expect(
    serializeSafeDiagnostic({
      event: "agent-request",
      password: "password",
      sessionToken: "token",
      providerCredential: "credential",
      rawAnswer: "answer",
      rawPrompt: "prompt",
    }),
  ).toEqual({
    log: { event: "agent-request" },
    clientError: { message: "Unable to complete this request." },
    audit: { event: "agent-request" },
  });
});
