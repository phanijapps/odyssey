import { expect, test } from "vitest";

// Integration smoke against a configured local Ollama endpoint
// (OLLAMA_INTEGRATION=1). Skipped otherwise by the runner env.
test("local model answers the fixed probe through the completion boundary", async () => {
  const { isOllamaConfigured } = await import("./agent");
  if (!isOllamaConfigured()) return;
  const { requestOllamaLearningQuestion } = await import("./agent");
  await expect(
    requestOllamaLearningQuestion({
      topicId:
        "Mathematics::Grade 6::Ratios and Proportional Relationships::6.RP.1",
      level: 2,
      standards: [
        {
          standardCode: "6.RP.1",
          standardText: "Understand the concept of a ratio.",
        },
      ],
    }),
  ).resolves.toMatchObject({ question: expect.any(String) });
});
