import { describe, expect, it, vi } from "vitest";
import { createQuestionPool, generateLazyQuestion } from "./adaptive-pool";
import type { GeneratedQuestion } from "./adaptive-pool";

const generated: GeneratedQuestion = {
  question: "A generated slope question with enough length to be valid here.",
  answer: "2",
  acceptableAnswers: [],
  hint: "Rise over run.",
  solution: ["Compute the rise.", "Compute the run.", "Divide."],
  diagramSvg: "",
};

describe("injected question generator", () => {
  it("uses the generator's validated question when one is provided", async () => {
    const generator = vi.fn().mockResolvedValue(generated);
    const pool = await createQuestionPool(
      "Mathematics::Grade 8::Expressions and Equations::8.EE.6",
      undefined,
      "practice",
      generator,
    );
    expect(generator).toHaveBeenCalledOnce();
    expect(pool.questions).toHaveLength(1);
    expect(pool.questions[0].question).toBe(generated.question);
    expect(pool.questions[0].answer).toBe("2");
    expect(pool.questions[0].id).toMatch(/^ai-/);
  });

  it("retries once on transient generator failure, then falls back to the bank", async () => {
    const generator = vi
      .fn<() => Promise<GeneratedQuestion>>()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue(generated);
    const question = await generateLazyQuestion(
      "Mathematics::Grade 8::Expressions and Equations::8.EE.6",
      2,
      [
        {
          standardCode: "8.EE.6",
          standardText:
            "Use similar triangles to explain why the slope m is the same between any two distinct points on a non-vertical line.",
        },
      ],
      undefined,
      generator,
    );
    expect(generator).toHaveBeenCalledTimes(2);
    expect(question?.question).toBe(generated.question);
  });

  it("falls back to a genuinely matching bank question when the generator keeps failing", async () => {
    const generator = vi
      .fn<() => Promise<GeneratedQuestion>>()
      .mockRejectedValue(new Error("down"));
    const question = await generateLazyQuestion(
      "Mathematics::Grade 8::Expressions and Equations::8.EE.6",
      2,
      [
        {
          standardCode: "8.EE.6",
          standardText:
            "Use similar triangles to explain why the slope m is the same between any two distinct points on a non-vertical line.",
        },
      ],
      undefined,
      generator,
    );
    expect(generator).toHaveBeenCalledTimes(2);
    expect(question).not.toBeNull();
    expect(question?.question.toLowerCase()).toContain("slope");
  });

  it("never calls a generator that is not provided", async () => {
    const question = await generateLazyQuestion("ratio", 2);
    expect(question).not.toBeNull();
    expect(question?.id).toMatch(/^bank-/);
  });
});
