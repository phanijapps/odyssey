import { describe, expect, it } from "vitest";
import { generateLazyQuestion } from "./adaptive-pool";

describe("bank fallback matches the selected standard, not the domain", () => {
  it("serves a slope question for 8.EE.6 (similar triangles / slope)", async () => {
    const question = await generateLazyQuestion(
      "Mathematics::Grade 8::Expressions and Equations::8.EE.6",
      2,
      [
        {
          standardCode: "8.EE.6",
          standardText:
            "Use similar triangles to explain why the slope m is the same between any two distinct points on a non-vertical line in the coordinate plane.",
        },
      ],
    );
    expect(question).not.toBeNull();
    expect(question!.question.toLowerCase()).toContain("slope");
    expect(question!.interaction).toEqual({
      type: "text-response",
      prompt: question!.question,
      response: { maxLength: 100 },
    });
    expect(JSON.stringify(question!.interaction)).not.toMatch(
      /answer|score|token|solution/i,
    );
    // The reported defect: a Grade 6 expression-evaluation question appeared.
    expect(question!.question).not.toContain("3x + 5");
  });

  it("returns null for a standard no bank topic genuinely covers", async () => {
    const question = await generateLazyQuestion(
      "Mathematics::Grade 8::Geometry::8.G.1",
      2,
      [
        {
          standardCode: "8.G.1",
          standardText:
            "Verify experimentally the properties of rotations, reflections, and translations.",
        },
      ],
    );
    // No bank topic covers transformations — no question beats a wrong one.
    expect(question).toBeNull();
  });
});
