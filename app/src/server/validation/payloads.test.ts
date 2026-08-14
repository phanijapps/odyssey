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
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="triangle" />',
    }),
  ).not.toThrow();
  expect(() =>
    validateA2UIPayload({
      component: "GeometryDiagram",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="triangle" />',
    }),
  ).not.toThrow();
  for (const payload of [
    { component: "QuestionCard", question: "What is 2 + 2?", level: 1 },
    { component: "ProgressIndicator", level: 1, correctStreak: 0 },
  ])
    expect(() => validateA2UIPayload(payload)).not.toThrow();
});

test("accepts the fixed SVG namespace required by standalone diagram images", () => {
  expect(() =>
    validateLearningPayload({
      component: "GeometryDiagram",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="triangle" viewBox="0 0 100 60" />',
    }),
  ).not.toThrow();
  expect(() =>
    validateLearningPayload({
      component: "GeometryDiagram",
      diagramSvg:
        '<svg xmlns="https://example.invalid/svg" aria-label="triangle" />',
    }),
  ).toThrow();
  expect(() =>
    validateLearningPayload({
      component: "GeometryDiagram",
      diagramSvg: '<svg aria-label="triangle" />',
    }),
  ).toThrow();
  expect(() =>
    validateLearningPayload({
      component: "GeometryDiagram",
      diagramSvg: '<text x="1" y="1">triangle</text>',
    }),
  ).toThrow();
  for (const diagramSvg of [
    'text<svg xmlns="http://www.w3.org/2000/svg" />',
    '<svg xmlns="http://www.w3.org/2000/svg" />text',
    '<svg xmlns="http://www.w3.org/2000/svg" />junk/>',
  ])
    expect(() =>
      validateLearningPayload({ component: "GeometryDiagram", diagramSvg }),
    ).toThrow();
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

test("accepts polygon and ellipse diagrams for geometry questions", () => {
  expect(() =>
    validateLearningPayload({
      component: "GeometryDiagram",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" aria-label="area" viewBox="0 0 200 100"><polygon points="20,80 20,40 70,40 70,80" fill="#8fc9dc" /><ellipse cx="150" cy="60" rx="30" ry="20" fill="none" stroke="#333333" stroke-width="2" /></svg>',
    }),
  ).not.toThrow();
});

test("accepts rgba fills on polygon figures (transformation diagrams)", () => {
  expect(() =>
    validateLearningPayload({
      component: "GeometryDiagram",
      diagramSvg:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260"><polygon points="50,50 140,50 50,140" fill="rgba(70,130,180,0.3)" stroke="#2c5f8a" stroke-width="2" /><polygon points="230,200 230,110 320,200" fill="rgba(200,80,80,0.3)" stroke="#a03030" stroke-width="2" /><text x="75" y="100" font-size="13" fill="#2c5f8a">Figure 1</text></svg>',
    }),
  ).not.toThrow();
});
