import { expect, test } from "vitest";
import {
  serializeSafeDiagnostic,
  validateA2UIPayload,
  validateLearningPayload,
} from "./payloads";

// STUB: AC7

test("STUB: AC7 accepts the approved SVG and app-owned A2UI payload", () => {
  expect(() =>
    validateLearningPayload({
      component: "GeometryDiagram",
      diagramSvg: '<svg aria-label="triangle" />',
    }),
  ).not.toThrow();
  expect(() =>
    validateA2UIPayload({
      component: "GeometryDiagram",
      diagramSvg: '<svg aria-label="triangle" />',
    }),
  ).not.toThrow();
  for (const payload of [
    { component: "QuestionCard", question: "What is 2 + 2?", level: 1 },
    { component: "ProgressIndicator", level: 1, correctStreak: 0 },
  ])
    expect(() => validateA2UIPayload(payload)).not.toThrow();
});

// STUB: AC9
test("STUB: AC9 rejects untyped input before persistence or rendering", () => {
  for (const payload of [
    { diagramSvg: "<script />" },
    { diagramSvg: '<svg><a href="https://example.invalid" /></svg>' },
    { diagramSvg: '<svg onload="alert(1)" />' },
    {
      component: "GeometryDiagram",
      diagramSvg: '<svg aria-label="triangle" onload />',
    },
    { component: "GeometryDiagram", unexpected: true },
    {
      component: "GeometryDiagram",
      diagramSvg:
        '<svg><line x1="0" y1="0" x2="1" y2="1" stroke="url&#40;https://example.invalid/paint.svg&#41;" /></svg>',
    },
    { tool: "unregistered-action" },
    { rawHtml: "<img src=x onerror=alert(1)>" },
    { serialized: '{"__proto__":{"polluted":true}}' },
  ]) {
    expect(() => validateLearningPayload(payload)).toThrow();
  }
  for (const payload of [
    { component: "Unknown" },
    {
      component: "QuestionCard",
      question: "Question",
      level: 1,
      rawHtml: "<script />",
    },
    { component: "ProgressIndicator", level: 0, correctStreak: 0 },
  ])
    expect(() => validateA2UIPayload(payload)).toThrow("Invalid A2UI payload");
});

// STUB: AC16
test("STUB: AC16 redacts every forbidden value from logs, client errors, and audit records", () => {
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
