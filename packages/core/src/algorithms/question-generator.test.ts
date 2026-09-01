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

/** A topic the reviewed bank does NOT cover (so the generator is the fallback). */
const UNCOVERED_TOPIC = "Mathematics::Grade 8::Geometry::8.G.1";
const UNCOVERED_STANDARD = [
  {
    standardCode: "8.G.1",
    standardText:
      "Verify experimentally the properties of rotations, reflections, and translations.",
  },
];

describe("injected question generator (bank-first, generator-fallback)", () => {
  it("serves a bank question instantly when the bank covers the skill (generator NOT called)", async () => {
    const generator = vi.fn().mockResolvedValue(generated);
    const pool = await createQuestionPool(
      "ratio", // bank-covered topic
      undefined,
      "practice",
      generator,
    );
    // Bank question served, generator never fired
    expect(generator).not.toHaveBeenCalled();
    expect(pool.questions).toHaveLength(1);
    expect(pool.questions[0].id).toMatch(/^bank-/);
  });

  it("uses the generator when the bank does not cover the skill", async () => {
    const generator = vi.fn().mockResolvedValue(generated);
    const pool = await createQuestionPool(
      UNCOVERED_TOPIC,
      UNCOVERED_STANDARD,
      "practice",
      generator,
    );
    expect(generator).toHaveBeenCalledOnce();
    expect(pool.questions).toHaveLength(1);
    expect(pool.questions[0].question).toBe(generated.question);
    expect(pool.questions[0].id).toMatch(/^ai-/);
  });

  it("retries the generator once on transient failure for uncovered skills", async () => {
    const generator = vi
      .fn<() => Promise<GeneratedQuestion>>()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue(generated);
    const question = await generateLazyQuestion(
      UNCOVERED_TOPIC,
      2,
      UNCOVERED_STANDARD,
      undefined,
      generator,
    );
    expect(generator).toHaveBeenCalledTimes(2);
    expect(question?.question).toBe(generated.question);
  });

  it("returns null for uncovered skills when the generator keeps failing", async () => {
    const generator = vi
      .fn<() => Promise<GeneratedQuestion>>()
      .mockRejectedValue(new Error("down"));
    const question = await generateLazyQuestion(
      UNCOVERED_TOPIC,
      2,
      UNCOVERED_STANDARD,
      undefined,
      generator,
    );
    expect(generator).toHaveBeenCalledTimes(2);
    expect(question).toBeNull();
  });

  it("returns null for uncovered skills with no generator", async () => {
    const question = await generateLazyQuestion(UNCOVERED_TOPIC, 2);
    expect(question).toBeNull();
  });
});
