import { expect, test } from "vitest";
import { assertAgentRequestBudget, redactAgentAudit, requestLearningFixture } from "./agent";

// STUB: AC7

test("STUB: AC7 supplies the approved local question and diagram fixture", async () => {
  await expect(
    requestLearningFixture({ childId: "child-1", topicId: "ratio", level: 1 }),
  ).resolves.toMatchObject({ question: expect.any(String), diagramSvg: expect.any(String) });
});

// STUB: AC12
test("STUB: AC12 rejects a model request beyond the configured budget", () => {
  expect(() =>
    assertAgentRequestBudget({
      requestCount: 2,
      timeoutMs: 15_000,
      retryCount: 1,
      maxTokens: 2048,
      maxCostUsd: 0.02,
    }),
  ).toThrow();
});

// STUB: AC14
test("STUB: AC14 redacts provider credentials and raw prompts from agent audit data", () => {
  expect(
    redactAgentAudit({ apiKey: "credential", rawPrompt: "sensitive instruction", event: "requested" }),
  ).toEqual({ event: "requested" });
});
